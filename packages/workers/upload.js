import { S3Client, PutObjectCommand, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketPolicyCommand, PutBucketWebsiteCommand } from "@aws-sdk/client-s3";

import fs from "fs";
import path from "path";
import mime from "mime-types"
import 'dotenv/config';


function getFilesRecursively(dir) {
    let results = []

    const list = fs.readdirSync(dir)

    for (const file of list) {
        const filePath = path.join(dir, file)
        const fileStat = fs.statSync(filePath)

        if (fileStat && fileStat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath))
        }
        else {
            results.push(filePath)
        }

    }

    return results;
}

async function createBucket(s3Client, bucketName, region) {
    try {
        await s3Client.send(new CreateBucketCommand({
            Bucket: bucketName,
            CreateBucketConfiguration: region !== "us-east-1" ? { LocationConstraint: region } : undefined,
        }));

        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false,
            },
        }));

        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Sid: "PublicReadGetObject",
                    Effect: "Allow",
                    Principal: "*",
                    Action: "s3:GetObject",
                    Resource: `arn:aws:s3:::${bucketName}/*`,
                }],
            }),
        }));

        // ← This was missing: enables static website hosting
        await s3Client.send(new PutBucketWebsiteCommand({
            Bucket: bucketName,
            WebsiteConfiguration: {
                IndexDocument: { Suffix: "index.html" },
                ErrorDocument: { Key: "error.html" },
            },
        }));

        console.log(`Bucket ${bucketName} created and configured for static hosting`);
        return bucketName
    } catch (err) {
        if (err.name === "BucketAlreadyOwnedByYou") {
            console.log(`Bucket ${bucketName} already exists`);
        } else {
            throw err;
        }
    }


}


async function deploy(outdir, S3Client, BUCKET_NAME) {

    try {

        const fileGet = getFilesRecursively(outdir);

        for (const filepath of fileGet) {

            const relative_path = path.relative(outdir, filepath);
            const s3Key = relative_path.replace(/\\/g, "/");


            const fileStream = fs.createReadStream(filepath)
            fileStream.on('error', (err) => {
                console.error(`Failed to read ${filepath}:`, err);
            });
            const content_type = mime.lookup(filepath) || 'application/octet-stream';

            const uploadParams = {
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: fileStream,
                ContentType: content_type,
            }

            await S3Client.send(new PutObjectCommand(uploadParams));




        }
        console.log("Deployment Successfull")
    }

    catch (err) {
        console.log("Deployment Failed", err)
    }

}


export default async function upload_aws(outputdir, deployment_id) {

    const s3Client = new S3Client({
        region: process.env.AWS_REGION, // Replace with your bucket's region
        credentials: {
            accessKeyId: process.env.AWS_ACCESSKEYID,
            secretAccessKey: process.env.AWS_SECRETACCESSKEY,
        },
    });

    const Bucket_name = `${deployment_id}`;

    console.log("Creating the Bucket.....");
    const bucketName = await createBucket(s3Client, Bucket_name, process.env.AWS_REGION)
    console.log("Creating the bucket completed ")


    if (bucketName) {
        console.log("Deploy the content into the bucket")
        await deploy(outputdir, s3Client, Bucket_name)
    }
    else {
        console.log("Deploy the bucket failed")
    }


}