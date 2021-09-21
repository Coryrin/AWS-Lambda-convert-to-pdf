const path = require('path');
const fs = require('fs');
const lambdafs = require('lambdafs');
const { execSync } = require('child_process');
let AWS = require('aws-sdk');

const inputPath = path.join('/opt', 'lo.tar.br'); 
const outputPath = '/tmp/';
const bucketName = 'docx-pdf-tester';

module.exports.handler = async (event, context) => {
	console.log(execSync('ls -alh /opt').toString('utf8'));

	try {
		let decompressed = {
			file: await lambdafs.inflate(inputPath)
		};
		console.log('output brotli de:----', decompressed); 
	} catch (error) {
		console.log('Error brotli de:----', error);
	}

	try {
		let execution = execSync('ls -alh /opt').toString('utf8');
		console.log(execution); 
	} catch (e) {
		console.log(e);
	}

	// get file from s3 bucket
	const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
	let s3 = new AWS.S3({apiVersion: '2006-03-01'});
	fs.createWriteStream('/tmp/' + key);

	const getObject = function(key) {
		const params = {
			Bucket: bucketName,
			Key: key
		}
		return new Promise(function(success, reject) {
			s3.getObject(params, (error, data) => {
				if (error) {
					return reject(error);
				}
				return success(data);
			});
		});
	}

	let fileData = await getObject(key);

	if (fileData) {
		fs.writeFileSync(outputPath + key, fileData.Body);

		// Pinched from here https://github.com/shelfio/libreoffice-lambda-layer
		const convertCommand = `export HOME=/tmp && /tmp/lo/instdir/program/soffice.bin --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to "pdf:writer_pdf_Export" --outdir /tmp /tmp/${key}`;

		console.log(execSync(convertCommand).toString('utf8'));
		console.log(execSync('ls -alh /tmp').toString('utf8'));

		function uploadFile(buffer, fileName) {
			return new Promise((resolve, reject) => {
				s3.putObject({
					Body: buffer,
					Key: fileName,
					Bucket: bucketName
				}, (error) => {
					if (error) {
						return reject(error);
					}
					return resolve(fileName);
				});
			});
		}

		let fileParts = key.substr(0, key.lastIndexOf(".")) + ".pdf";
		let fileB64data = fs.readFileSync(outputPath + fileParts);
		await uploadFile(fileB64data, 'converted_pdf/' + fileParts);
		return true;
	}
	return false;
};