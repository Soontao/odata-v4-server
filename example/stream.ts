import * as fs from 'fs';
import { Db, MongoClient, ObjectID } from 'mongodb';
import { createFilter, createQuery } from 'odata-v4-mongodb';
import * as path from 'path';
import { PassThrough, Readable, Writable } from 'stream';
import { Edm, odata, ODataController, ODataHttpContext, ODataQuery, ODataServer, ODataStream } from '../lib';
import { Category, Product } from './model';

const mongodb = async function (): Promise<Db> {
  return (await MongoClient.connect('mongodb://localhost:27017/odataserver')).db();
};

const delay = async function (ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

@odata.type(Product)
class ProductsController extends ODataController {
  /*@odata.GET
  *find(@odata.query query:ODataQuery, @odata.stream stream:Writable):any{
      let db:Db = yield mongodb();
      let mongodbQuery = createQuery(query);
      if (typeof mongodbQuery.query._id == "string") mongodbQuery.query._id = new ObjectID(mongodbQuery.query._id);
      if (typeof mongodbQuery.query.CategoryId == "string") mongodbQuery.query.CategoryId = new ObjectID(mongodbQuery.query.CategoryId);
      return db.collection("Products")
          .find(
              mongodbQuery.query,
              mongodbQuery.projection,
              mongodbQuery.skip,
              mongodbQuery.limit
          ).stream().pipe(stream);
  }*/
  // example using generator with mongodb .next() and passing entity data into OData stream
  @odata.GET
  *find(@odata.query query: ODataQuery, @odata.stream stream: Writable) {
    const db: Db = yield mongodb();
    const mongodbQuery = createQuery(query);
    if (typeof mongodbQuery.query._id == 'string') { mongodbQuery.query._id = new ObjectID(mongodbQuery.query._id); }
    if (typeof mongodbQuery.query.CategoryId == 'string') { mongodbQuery.query.CategoryId = new ObjectID(mongodbQuery.query.CategoryId); }
    const cursor = db.collection('Products')
      .find(
        mongodbQuery.query, {
        projection: mongodbQuery.projection,
        skip: mongodbQuery.skip,
        limit: mongodbQuery.limit
      }
      );
    let item = yield cursor.next();
    while (item) {
      stream.write(item);
      item = yield cursor.next();
    }
    stream.end();
  }

  @odata.GET
  *findOne(@odata.key() key: string, @odata.query query: ODataQuery) {
    const db: Db = yield mongodb();
    const mongodbQuery = createQuery(query);
    return db.collection('Products').findOne({ _id: new ObjectID(key) }, {
      fields: mongodbQuery.projection
    });
  }

  @odata.POST
  async insert(@odata.body data: any) {
    const db = await mongodb();
    if (data.CategoryId) { data.CategoryId = new ObjectID(data.CategoryId); }
    return await db.collection('Products').insert(data).then((result) => {
      data._id = result.insertedIds;
      return data;
    });
  }
}

@odata.type(Category)
class CategoriesController extends ODataController {
  @odata.GET
  *find(@odata.query query: ODataQuery): any {
    const db: Db = yield mongodb();
    const mongodbQuery = createQuery(query);
    if (typeof mongodbQuery.query._id == 'string') { mongodbQuery.query._id = new ObjectID(mongodbQuery.query._id); }
    const cursor = db.collection('Categories')
      .find(
        mongodbQuery.query, {
        projection: mongodbQuery.projection,
        skip: mongodbQuery.skip,
        limit: mongodbQuery.limit
      }
      );
    const result = yield cursor.toArray();
    result.inlinecount = yield cursor.count(false);
    return result;
  }

  @odata.GET
  *findOne(@odata.key() key: string, @odata.query query: ODataQuery) {
    const db: Db = yield mongodb();
    const mongodbQuery = createQuery(query);
    return db.collection('Categories').findOne({ _id: new ObjectID(key) }, {
      fields: mongodbQuery.projection
    });
  }
}

enum Genre {
  Unknown,
  Pop,
  Rock,
  Metal,
  Classic
}

@Edm.MediaEntity('audio/mp3')
class Music extends PassThrough {
  @Edm.Key
  @Edm.Computed
  @Edm.TypeDefinition(ObjectID)
  //@Edm.Int32
  Id: ObjectID

  @Edm.String
  Artist: string

  @Edm.String
  Title: string

  @Edm.EnumType(Genre)
  Genre: Genre

  @Edm.TypeDefinition(ObjectID)
  uid: ObjectID
}

@odata.namespace('NorthwindTypes')
class NorthwindTypes extends Edm.ContainerBase {
  @Edm.Flags
  @Edm.Int64
  @Edm.Serialize((value) => `NorthwindTypes.Genre2'${value}'`)
  Genre2 = Genre

  @Edm.String
  @Edm.URLDeserialize((value: string) => new Promise((resolve) => setTimeout((_) => resolve(new ObjectID(value)), 1000)))
  @Edm.Deserialize((value) => new ObjectID(value))
  ObjectID2 = ObjectID

  Music2 = Music
}

@odata.type(Music)
@odata.container('Media')
class MusicController extends ODataController {
  @odata.GET
  find(@odata.filter filter: ODataQuery, @odata.query query: ODataQuery) {
    console.log(JSON.stringify(createQuery(query).query, null, 2), JSON.stringify(createFilter(filter), null, 2));
    const music = new Music();
    music.Id = new ObjectID;
    music.Artist = 'Dream Theater';
    music.Title = 'Six degrees of inner turbulence';
    music.Genre = Genre.Metal;
    music.uid = new ObjectID();
    return [music];
  }

  @odata.GET
  findOne(@odata.key() _: number) {
    const music = new Music();
    music.Id = new ObjectID;
    music.Artist = 'Dream Theater';
    music.Title = 'Six degrees of inner turbulence';
    music.Genre = Genre.Metal;
    music.uid = new ObjectID();
    return music;
  }

  @odata.POST
  insert(@odata.body body: Music) {
    body.Id = new ObjectID();
    console.log(body);
    return body;
  }

  @odata.GET.$value
  mp3(@odata.key _: number, @odata.context context: ODataHttpContext) {
    const file = fs.createReadStream('tmp.mp3');
    return new Promise((resolve, reject) => {
      file.on('open', () => {
        context.response.on('finish', () => {
          file.close();
        });
        resolve(file);
      }).on('error', reject);
    });
  }

  @odata.POST.$value
  post(@odata.key _: number, @odata.body context: ODataHttpContext) {
    const file = fs.createWriteStream('tmp.mp3');
    return new Promise((resolve, reject) => {
      file.on('open', () => {
        context.request.pipe(file);
      }).on('error', reject);
      context.request.on('end', resolve);
    });
  }
}

class ImageMember {
  @Edm.String
  value: string
}

@Edm.OpenType
class Image {
  @Edm.Key
  @Edm.Computed
  @Edm.Int32
  Id: number

  @Edm.String
  Filename: string

  @Edm.Collection(Edm.ComplexType(ImageMember))
  Members: ImageMember[]

  @Edm.Stream('image/png')
  Data: ODataStream

  @Edm.Stream('image/png')
  Data2: ODataStream
}

@odata.type(Image)
@odata.container('Media')
class ImagesController extends ODataController {
  @odata.GET
  images(@odata.key id: number) {
    const image = new Image();
    image.Id = id;
    image.Filename = 'tmp.png';
    (<any>image).mm = [[1, 2], [3, 4]];
    return image;
  }

  @odata.GET('Members')
  *getMembers(@odata.key _: number, @odata.stream stream: Writable) {
    for (let i = 0; i < 10; i++) {
      stream.write({ value: `Member #${i}` });
      yield delay(1);
    }
    stream.end();
  }

  @odata.GET('Data')
  @odata.GET('Data2').$value
  getData(@odata.key _: number, @odata.context context: ODataHttpContext, @odata.result result: Image) {
    return new ODataStream(fs.createReadStream(result.Filename)).pipe(context.response);
  }

  @odata.POST('Data')
  @odata.POST('Data2').$value
  postData(@odata.key _: number, @odata.body data: Readable, @odata.result result: Image) {
    return new ODataStream(fs.createWriteStream(result.Filename)).write(data);
  }
}

@Edm.OpenType
class PlainObject { }

@Edm.Container(NorthwindTypes)
@odata.controller(ProductsController, true)
@odata.controller(CategoriesController, true)
@odata.controller(MusicController, true)
@odata.controller(ImagesController, true)
class StreamServer extends ODataServer {
  @Edm.TypeDefinition(ObjectID)
  @Edm.FunctionImport
  objid(@Edm.TypeDefinition(ObjectID) v: ObjectID) {
    return v.toHexString();
  }

  @Edm.FunctionImport(Edm.String)
  stringify(@Edm.EntityType(PlainObject) obj: any): string {
    return JSON.stringify(obj);
  }

  @odata.container('almafa')
  @Edm.FunctionImport(Edm.Stream)
  async Fetch(@Edm.String filename: string, @odata.stream stream: Writable, @odata.context context: any) {
    const file = fs.createReadStream(filename);
    return file.on('open', () => {
      context.response.contentType(path.extname(filename));
      file.pipe(stream);
    });
  }
}
//console.dir(createMetadataJSON(StreamServer).dataServices.schema[0]["function"][1].parameter);
//console.log(createMetadataJSON(StreamServer).dataServices.schema[0].entityType[2]);
//console.log(StreamServer.$metadata().edmx.dataServices.schemas[0].typeDefinitions);
StreamServer.create('/odata', 3000);
