import { app, BrowserWindow, screen, ipcMain, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
// import * as NodeID3 from 'node-id3';
import * as musicmetadata from 'music-metadata';


//import * as td3 from './td3';

// Initialize remote module
require('@electron/remote/main').initialize();


let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function makeMenu() {
let template: Electron.MenuItemConstructorOptions[] = [
  {
    label: process.platform === 'darwin' ? 'Electron' : 'File',
    submenu: [
      { role: 'quit' },
    ]
  },
  {
    label: 'Edit',
    submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { role: 'forceReload'},
        { role: 'toggleDevTools'},
    ]
  },
  { role: 'window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  {
      role: 'help',
      submenu: [{
          label: 'Learn More',
          click() {                           require('electron').shell.openExternal('https://electron.atom.io');
          }
      }]
  }
];
return template;
}

const menu = Menu.buildFromTemplate(makeMenu());

// one renderer binding to rule all of td3...
// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'td3', 'setBpm', bpm );
ipcMain.handle('fs', async (event, FUNC, ...values) => {
  console.log( `[main.ts] fs.${FUNC}( ${values.join(", ")} )` )
  let result = fs.hasOwnProperty( FUNC ) ? await fs[FUNC](...values) : `ERROR: no such function as fs.${FUNC}(...)`;
  console.log( `       <= ${JSON.stringify( result )}` )
  return result;
})

ipcMain.handle('fs.statSync', async (event, arg, FUNC, ...values) => {
  //let existd = fs.statSync("/Volumes").isDirectory()
  //let existf = fs.statSync("/Volumes").isFile()
  //console.log( "exist", existd, existf )

  console.log( `[main.ts] fs.statSync( ${arg} ).${FUNC}( ${values.join(", ")} )` )
  let statObj = fs.statSync(arg);
  //console.log( `       statObj = ${JSON.stringify( statObj )}` )
  let result = await statObj[FUNC](...values);
  console.log( `       <= ${JSON.stringify( result )}` )
  return result;
})

function getType( fullpath ) {
  try {
    let type = fs.statSync( fullpath ).isDirectory() ? "dir" : "file"
    console.log( type , fullpath )
    return type;
  } catch (e) {
    return "unreadable";
  }
}

function getTime( fullpath ) {
  try {
    return fs.statSync( fullpath ).mtimeMs;
  } catch (e) {
    return -1;
  }
}

function getExt( filename ) {
  let m = filename.match( /\.[^\.]+$/ );
  //console.log( path, m )
  return m ? m[0] : ""
}

function getPath( filepath ) {
  return filepath.replace( /\/[^\/]+$/, "" )
}

function getFilename( filepath ) {
  return filepath.replace( /^.*\//, "" ).replace( /\.[^\.]+$/, "" ); // remove path and ext
}

function shortenImageName( i, rootdir ) {
  return i.replace( "file://" + rootdir + "/", "" ).replace( /\.[^\.]+$/, "" )
}

function getImage( filepath ) {

  // if (fs.statSync( filepath ).isDirectory()) {
  // }
  let path_filename = path.join( getPath( filepath ), getFilename( filepath ) );
  let image = (
    fs.existsSync( path.join( filepath, "Folder.jpg" ) ) ? ("file://" + path.join( filepath, "Folder.jpg" )) :
    fs.existsSync( path.join( filepath, "Folder.png" ) ) ? ("file://" + path.join( filepath, "Folder.png" )) :
    fs.existsSync( path.join( filepath, "Folder.gif" ) ) ? ("file://" + path.join( filepath, "Folder.gif" )) :
    fs.existsSync( path_filename + ".jpg" ) ? ("file://" + path_filename + ".jpg") :
    fs.existsSync( path_filename + ".png" ) ? ("file://" + path_filename + ".png") :
    fs.existsSync( path_filename + ".gif" ) ? ("file://" + path_filename + ".gif") :
    fs.existsSync( path.join( getPath( filepath ), "Folder.jpg" ) ) ? ("file://" + path.join( getPath( filepath ), "Folder.jpg" )) :
    fs.existsSync( path.join( getPath( filepath ), "Folder.png" ) ) ? ("file://" + path.join( getPath( filepath ), "Folder.png" )) :
    fs.existsSync( path.join( getPath( filepath ), "Folder.gif" ) ) ? ("file://" + path.join( getPath( filepath ), "Folder.gif" )) :
    "/assets/default.png"
  )
  //console.log( filepath, "=>", image.slice( 0, 100 ) );
  return image;
}

function toHumanReadableTime( d ) {
  //return `${Math.floor(d / 60).toString()}:${Math.floor(d % 60).toString()}`   // 01:33
  return d < 60 ? `${Math.floor(d)}s` : (d / 60) < 60 ? `${Math.floor(d / 60).toString()}m` : `${Math.floor(d / (60*60)).toString()}h`     // 1m
}

ipcMain.handle('getRunningTime', async (event, file) => {
  if (fs.existsSync( file ) && fs.statSync( file ).isFile() && file.match( /m4a|aac|mp3|wav$/i )) {
    const tags = await musicmetadata.parseFile( file, { duration: true } ); // duration takes a long time for mp3 files...
    if (tags?.format?.duration) {
      let runningtime = tags.format.duration ? toHumanReadableTime( tags.format.duration ) : "--";
      let duration = tags.format.duration;
      return { duration, runningtime };
    } else
      return undefined;
  }
})

ipcMain.handle('getListing', async (event, dir) => {
  // filter ".." dirs out of the path:   /path/to/..
  dir = dir.replace( /\/[^/]+\/\.\./g, "" );   if (dir.length == 0) dir = "/";

  if (!fs.existsSync(dir)) {
    return {
      image_dict: {},
      listing: []
    }
  }

  console.log( `[main.ts] getListing( "${dir}" )` )
  let result = [];
  if (fs.statSync( dir ).isDirectory()) {
    result = fs.readdirSync( dir );
    result = result.map( r => {
        let fullpath = path.join( dir, r );
        return { path: r, fullpath: fullpath, ext: getExt( r ), type: getType( fullpath ), time: getTime( fullpath ), image: getImage( fullpath ) }
      })
      // only let through dirs or audio files
      .filter( r => r.type == "dir" || (r.type == "file" && r.ext.match( /m4a|aac|mp3|wav/i )) ) // |txt|jpg|png|gif

      // fill in pretty names
      for (let x = 0; x < result.length; ++x) {
        let r = result[x];

        // https://www.npmjs.com/package/node-id3
        if (r.type == "file" && r.ext.match( /m4a|aac|mp3|wav/i )){
          const tags = await musicmetadata.parseFile( r.fullpath, { duration: false } ); // duration takes a long time for mp3 files...
          console.log( "tagging....", r, tags )
          //r.path = tags.common.title ? tags.common.title : r.path;
          r.title = tags.common.title;
          r.artist = tags.common.artist;
          r.album = tags.common.album;
          if (tags.common.picture) {
            let picture = musicmetadata.selectCover( tags.common.picture ); // pick the cover image
            if (picture) {
              r.picture = convertBufferToImageEmbed( picture.data, picture.format );
              //console.log( "picture", r.picture )
            }
          }
          r.duration = tags.format.duration
          r.runningtime = tags.format.duration ? toHumanReadableTime( tags.format.duration ) : "??";
        }
      }

    // sort certain directories by time:
    if (dir.match( /\/(Documents|Downloads)$/ ))
      result = result.sort( (a, b) => a.time == b.time ? 0 : a.time < b.time ? 1 : -1 )
  }
  //console.log( `       <= ${JSON.stringify( result )}` )

  let image_dict = result.map( r => r.image ) // get an array of all image filenames
  // uniquify the array of filenames
  image_dict = Array.from( new Set(image_dict) );
  // suck in the image data (base64 encoded, ready to go for <img src=""> with mimetype, etc.)
  // shorten the image lookup name to just the filename without ext
  image_dict = image_dict.map( r => { return { name: shortenImageName( r, dir ), data: r.match( /^file:\/\// ) ? convertFileToImageEmbed( r ) : r } } )
  result = result.map( r => { r.image = shortenImageName( r.image, dir ); return r; })

  // convert the array to an object dictionary of [name]: data
  image_dict = image_dict.reduce((acc, image_dict_entry) => {
    return {...acc, [image_dict_entry.name]: image_dict_entry.data};
  }, {});



  //console.log( "image_dict", image_dict )

  // add in the .. directory at the top
  if (dir != "/") {
    result = [
      { path: "..", fullpath: dir.replace( /\/[^\/]+$/, "" ), type: "dir", ext: "" },
      ...result
    ]
  }

  let packed_result = {
    image_dict: image_dict,
    listing: result
  };
  //console.log( `       <= ${JSON.stringify( packed_result )}` )
  //console.log( `       <= ${JSON.stringify( packed_result ).length} bytes` )
  return packed_result;
})

function convertBufferToImageEmbed( buffer, format ) {
  return `data:${format};base64,` + buffer.toString('base64')
}

function convertFileToImageEmbed( fileURL ) {
  const filepath = fileURL.replace( /^file:\/\//, '' );
  let result = undefined;
  if (fs.existsSync( filepath ) && fs.statSync( filepath ).isFile()) {
    result = `data:${getMime(filepath)};base64,` + fs.readFileSync( filepath, { encoding: "base64" } )
  }
  return result;
}

function getMime( filename ) {
  switch (getExt( filename )) {
    case ".jpg": return "image/jpeg";
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".wav": return "audio/wav";
    case ".mp3": return "audio/mp3";
    case ".m4a": return "audio/x-m4a";
    default: return "data/blob" // todo: what's the real type here?
  }
}

ipcMain.handle('readFileSync', async (event, fileURL, mimeType="base64") => {
  console.log( `[main.ts] readFileSync( "${fileURL}" )` )
  let result = convertFileToImageEmbed( fileURL );
  //let base64 = "data:audio/m4a;base64," + result.toString('base64');
  console.log( `       <= ${result.length} bytes` )
  //console.log( result.slice( 0, 100 ) );
  return result;
})

//////////////////////////////////////////////////////////////////////////

function createWindow(): BrowserWindow {
  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      //devTools: false,
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      contextIsolation: false,  // false if you want to run e2e test with Spectron
      enableRemoteModule : true // true if you want to run e2e test with Spectron or use remote module in renderer context (ie. Angular)
    },
  });



  if (serve) {
    win.webContents.openDevTools();
    require('electron-reload')(__dirname, {
      electron: require(path.join(__dirname, '/../node_modules/electron'))
    });
    win.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html';

    if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
       // Path when running electron in local folder
      pathIndex = '../dist/index.html';
    }

    win.loadURL(url.format({
      pathname: path.join(__dirname, pathIndex),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400)
    Menu.setApplicationMenu(menu);
  });

  /*
  app.on('ready', () => {
    // Register a shortcut listener for Ctrl + Shift + I
    globalShortcut.register('Control+Shift+I', () => {
        // When the user presses Ctrl + Shift + I, this function will get called
        // You can modify this function to do other things, but if you just want
        // to disable the shortcut, you can just return false
        return false;
    });
  });
  */

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      app.quit();
    //}
  });

  app.on('will-quit', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      //app.quit();
      console.log( "will quit" )
      //app.exit(0);
    //}
  });

  process.on('beforeExit', (code) => {
    console.log( "beforeExit" )
    if (code) {
     //process.exit(code);
    }
   });


  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
