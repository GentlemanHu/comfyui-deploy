"use server";

import { replaceCDNUrl } from "./replaceCDNUrl";

export async function getFileDownloadUrl(file: string) {
  return replaceCDNUrl(
    `${process.env.SPACES_PUBLIC_ENDPOINT ?? process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/${file}`
  );
}
