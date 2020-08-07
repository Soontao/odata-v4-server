const path = require('path');

module.exports = async () => {
  // fix HANA module not work in Jest Test Framework

  // if specify hana user in system environment
  if (process.env.HANA_USER) {

    let extensions = {
      'darwin': 'dylib',
      'linux': 'so',
      'win32': 'dll'
    };

    // Look for prebuilt binary and DBCAPI based on platform
    let pb_subdir = null;
    if (process.platform === 'linux') {
      if (process.arch === 'x64') {
        pb_subdir = 'linuxx86_64-gcc48';
      } else if (process.arch.toLowerCase().indexOf('ppc') != -1 && os.endianness() === 'LE') {
        pb_subdir = 'linuxppc64le-gcc48';
      } else {
        pb_subdir = 'linuxppc64-gcc48';
      }
    } else if (process.platform === 'win32') {
      pb_subdir = 'ntamd64-msvc2010';
    } else if (process.platform === 'darwin') {
      pb_subdir = 'darwinintel64-xcode7';
    }

    let modpath = path.dirname(require.resolve("@sap/hana-client/README.md"));
    let pb_path = path.join(modpath, 'prebuilt', pb_subdir);
    let dbcapi = process.env['DBCAPI_API_DLL'] || path.join(pb_path, 'libdbcapiHDB.' + extensions[process.platform]);

    process.env['DBCAPI_API_DLL'] = dbcapi;
    
  }


};