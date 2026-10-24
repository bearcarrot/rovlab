import { test } from "node:test";
import assert from "node:assert/strict";
import { sigv4 } from "../../supabase/functions/_shared/r2.ts";

// Official AWS SigV4 example ("GET Object" with Range header, examplebucket, 2013-05-24):
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
test("sigv4 reproduces the documented AWS example signature", async () => {
  const h = await sigv4({
    method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", headers: { Range: "bytes=0-9" },
    payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1", service: "s3", amzDate: "20130524T000000Z",
  });
  assert.equal(
    h.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
  );
});
