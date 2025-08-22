import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import unzipper from 'unzipper';
import archiver from 'archiver';
import formidable from 'formidable';
import { generateFonts } from 'fantasticon';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const form = new formidable.IncomingForm();
  const formResult = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const zipFile = formResult.files.icons;
  if (!zipFile) {
    res.status(400).send("Arquivo ZIP não enviado");
    return;
  }

  // Extraindo SVGs para temp
  const id = Math.random().toString(36).slice(2);
  const workDir = path.join(os.tmpdir(), `svgfont_${id}`);

  await fs.mkdir(workDir, { recursive: true });
  await fs.createReadStream(zipFile.filepath || zipFile.path)
    .pipe(unzipper.Extract({ path: workDir }))
    .promise();

  // Gera fonte Fantasticon
  const outDir = path.join(os.tmpdir(), `outfont_${id}`);
  await fs.mkdir(outDir, { recursive: true });
  await generateFonts({
    inputDir: workDir,
    outputDir: outDir,
    fontTypes: ['ttf', 'woff', 'woff2', 'eot'],
    assetTypes: ['css', 'html', 'json'],
    name: 'iconfont'
  });

  // Zip final
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=iconfont.zip");
  const archive = archiver('zip');
  archive.pipe(res);
  archive.directory(outDir, false);
  await archive.finalize();
}
