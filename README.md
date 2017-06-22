# JPEG-Renamer

Sometimes shuffling photos around with various programs like Apple's Photos creates issues with file names and metadata, like erasing and renaming. To combat this, JPEG-Renamer digs into the embedded data within a JPEG file (in this case a short description of said file) and replaces the original file name with the image description, in case the user doesn't want to deal with file names like DCKF0774.jpg.

#### Current Usage:
1. load the app.js into the Node 8 REPL
2. run 'checkForJPEGs' with a directory name (absolute path)
3. all JPEGs in the directory, as well as any in any sub-directories will be renamed according to their embedded information

---
### ISSUES:
- the ImageMagick module loads an entire image into memory, 'fast-exit' is the preferred option but not all files use the EXIF 'ImageDescription'
