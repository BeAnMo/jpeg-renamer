/*********************************************************/
/******** Rename JPEG files with ImageMagick *************/
const im   = require('imagemagick'),
      exif = require('fast-exif'),
      util = require('util'),
      path = require('path'),
      fs   = require('fs');


/* String -> Promise
    takes in an at specified path: imgPath, and returns 
    a Promise based on im.identify  */
function createIdentifyAsPromise(imgPath){
    return new Promise((success, failure) => {
        return im.identify(imgPath, (err, data) => {
            if(err) return failure(err);
            
            return success(data);
        });
    });
}

/* allows util.promisify to use im.identify */
im.identify[util.promisify.custom] = createIdentifyAsPromise;


/* Object, Object, String, String, String -> Void
    takes in IM image data and cache, as well as an image name, its absolute path,
    and its current working directory
    and renames the image file based on the appropriate meta-data
    if a file with the same IM data signature has been encountered, it will
    ignore the current file  */
function dataToName(data, cache, img, imgPath, cwd){
    const fsRename = util.promisify(fs.rename);
    
    try {
        let newPath;
        let newName;
        
        // are files that have a data.profiles[...] attribute being erased?
        // as in the property is present but is empty, so then the new file
        // is basically ignored?
        if(data === undefined){
            throw new Error('UNDEFINED IM DATA');
            return;
        } else if(data.properties.signature in cache.files){
            // file has been encountered
            console.log('SIGNATURE IN CACHE:', imgPath);
            newName = null;
        } else if(data.profiles['image name[2,5]']){
            newName = formatDescription(data.profiles['image name[2,5]']);
            cache.files[data.properties.signature] = true;
            
            if(newName in cache.names){
                cache.names[newName] += 1;
            } else {
                cache.names[newName] = 0;
            }
            
            newPath = path.resolve(cwd, newName + '-' + cache.names[newName] + '.jpg');
        }
        
        if(newName === null){
            return console.log('FILE PREVIOUSLY WRITTEN');
        } else if(newPath === undefined){
            return console.log('DATA PROFILE IS UNDEFINED:', imgPath);
        } else {    
            return fsRename(imgPath, newPath).then(() => {
                return console.log('old: ' + img + '\tnew: ' + newName + '-' + cache.names[newName] + '.jpg');
            }).catch(console.error);
        }

    } catch(err){
        return console.error('DATA.PROFILE OF ' + img + ': ' + err);
    }
}

/* String, String, String, Object -> Void
    renames an existing image in the the CWD using ImageMagick 
    data attributes embedded within the image, while the cache 
    ensures multiples images do not receive the same name  */
function renameImgWithIM(imgPath, img, cwd, cache){
    const IM_identify = util.promisify(im.identify);
    
    return IM_identify(imgPath).then((data) => {
        return dataToName(data, cache, img, imgPath, cwd)    
    }).catch(console.error);
}

/* String, String, String -> Void
    renames an existing image in the CWD, using EXIF data 
    attributes embedded within the image  */
function renameImgWithEXIF(imgPath, img, cwd){
    return exif.read(imgPath).then((data) => {
        console.log(img + ': ' + data.image.ImageDescription);
    }).catch(console.error)
}

/* String -> String
    formats an image description to replace spaces, '\', & '/' with '-', 
    and all lower case letters  */
function formatDescription(imgDesc){
    let desc = imgDesc.toLowerCase();
    let re = /\s|\\|\//gi;
    
    return desc.replace(re, '-');
}


/* String -> Boolean
    checks file extension to ensure a jpg/jpeg file  */
function isJPEG(file){
    let checkEnd = (f, p, j) => { return f.substring(f.length - p, f.length) === j; };
    let checkFront = (f) => { return f.substring(0, 2) !== '._'; };
    
    let jpg = checkEnd(file, 4, '.jpg');
    let jpeg = checkEnd(file, 5, '.jpeg');
  
    return (jpg || jpeg) && checkFront(file);
}

/* String -> Void
    checks a given directory for JPEGs to rename, if none are present, 
    the program moves into each sub directory present  */
function checkForJPEGs(absRootDir){
    const readdir_PROM = util.promisify(fs.readdir);
    const fStat_PROM   = util.promisify(fs.stat);
    
    const cache = {
        names: {},
        files: {}
    };
 
    /* String -> Array
        checks directory for JPEG files  */
    async function checkDirectory(parent){
        try {
            const dirContent = await readdir_PROM(parent);

            return checkDirContents(parent, dirContent);
        } catch(e){
            return console.error('checkDirectory', e);
        }   
    }
    
    /* String -> String or False
        checks to see if a given file is a JPEG/JPG, 
        if the file is a JPEG/JPG, the file is renamed, 
        else returns false  */
    async function checkFile(parent, file){
        try {
            const filePath = path.join(parent, file);
            const fstats = await fStat_PROM(filePath);
            
            if(fstats.isFile() && isJPEG(file)){
                return renameImgWithIM(filePath, file, parent, cache);
                //return renameImgWithEXIF(filePath, file, parent);
            } else {
                return false;
            }
        } catch(e){
            return console.error('checkFile', e);
        }
        
    }
    
    /* String -> String or False
        checks to see if a given file is a directory, 
        returns the dirName, false otherwise  */
    async function checkDir(parent, dir){
        try{
            const dirPath = path.join(parent, dir);
            const fstats = await fStat_PROM(dirPath);
            if(fstats.isDirectory()){
                return dirPath;
            } else {
                return false;
            }
        } catch(e){
            return console.error('checkDir:', e);
        }        
    }

    /* Array -> Void
        checks directory for JPEG files  */
    async function checkDirContents(parent, dc){
        return dc.forEach((file) => {
            checkDir(parent, file).then((dirRes) => {
                if(typeof(dirRes) === 'string'){
                    return checkDirectory(dirRes);
                } else {
                    return checkFile(parent, file);
                }
            }).catch((e) => console.error(e));
        });
    }
    
    return checkDirectory(absRootDir);
}


module.exports = {
    renameImgIM: renameImgWithIM,
    checkForJPEGs: checkForJPEGs
}
