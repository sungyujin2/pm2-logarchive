var s3 = require('s3');
var fs = require('fs');
var walk    = require('walk');
var config = require('./config.json')

var client = s3.createClient({
    maxAsyncS3: 20,     // this is the default
    s3RetryCount: 3,    // this is the default
    s3RetryDelay: 1000, // this is the default
    multipartUploadThreshold: 20971520, // this is the default (20 MB)
    multipartUploadSize: 15728640, // this is the default (15 MB)
    s3Options: config.s3Options
});

setInterval(function() {
	observe();
}, config.observetime)

function observe() {

	var files   = [];
	var walker  = walk.walk(config.root, { followLinks: false });

	walker.on('file', function(root, stat, next) {
		var getDate = stat.name.split('__')[1];
	    if(getDate) {
	        var filedate = new Date(((getDate.split('.log'))[0]).split('-').slice(0,3));
	        filedate.setHours(((getDate.split('.log'))[0]).split('-')[3])
	        filedate.setMinutes(((getDate.split('.log'))[0]).split('-')[4])

	        var time = 60 * 60 * 1000;
	        if(Math.floor((new Date().getTime() - filedate.getTime()) / time) > config.archivetime)
	            files.push({ 'root' : root + "/" + stat.name, 'name': stat.name});
	    }
	    next();
	});

	walker.on('end', function() {
	    console.log(files)
	    for(var file in files) {
	        upload(files[file], config.archive)
	    }
	});
}

function upload(file, archive) {
    var params = {
        localFile: file.root,
        s3Params: {
            Bucket: archive.bucket,
            Key: archive.root + file.name
        }
    };

    var uploader = client.uploadFile(params);
    
    uploader.on('error', function(err) {
        console.error("unable to upload:", err.stack);
    });
    uploader.on('progress', function() {
        console.log("progress", uploader.progressMd5Amount,
            uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', function() {
        console.log("done uploading");
        if(config.deleteoption) {
            fs.unlink(file.root, function (err) {
                if (err) throw err;
                console.log('successfully deleted' + file.root);
            });
        }
    });
}