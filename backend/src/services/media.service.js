/**
 * Media Service — FFmpeg tabanlı resim ve video işleme (child_process)
 *
 * Harici npm bağımlılığı yok — sadece sistem PATH'inde ffmpeg/ffprobe gerekli.
 * Docker: `apk add ffmpeg`  ·  macOS: `brew install ffmpeg`
 *
 * Resim : çözünürlük düşürme, JPEG'e dönüştürme, kalite ayarı
 * Video : çözünürlük düşürme, H.264 + AAC, fast-start
 * Avatar: kare kırp + küçült + JPEG
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class MediaService {
  /**
   * @param {Object} opts
   * @param {number}  [opts.imageMaxWidth=1920]
   * @param {number}  [opts.imageMaxHeight=1080]
   * @param {number}  [opts.imageQuality=5]       qscale:v (2 = en iyi, 31 = en kötü)
   * @param {number}  [opts.avatarSize=256]
   * @param {number}  [opts.videoMaxHeight=720]
   * @param {string}  [opts.ffmpegPath='ffmpeg']
   * @param {string}  [opts.ffprobePath='ffprobe']
   */
  constructor(opts = {}) {
    this.imageMaxWidth  = opts.imageMaxWidth  || 1920;
    this.imageMaxHeight = opts.imageMaxHeight || 1080;
    this.imageQuality   = opts.imageQuality   || 5;
    this.avatarSize     = opts.avatarSize     || 256;
    this.videoMaxHeight = opts.videoMaxHeight || 720;
    this.ffmpegPath     = opts.ffmpegPath    || 'ffmpeg';
    this.ffprobePath    = opts.ffprobePath   || 'ffprobe';
    this.tmpDir         = os.tmpdir();
  }

  /* ────────────────────────── helpers ──────────────────────────────────── */

  /** Buffer → geçici dosya yaz */
  _writeTmp(buffer, ext) {
    const p = path.join(this.tmpDir, `chatterbox_${uuidv4()}${ext}`);
    fs.writeFileSync(p, buffer);
    return p;
  }

  /** Geçici dosyaları temizle */
  _cleanup(...paths) {
    for (const p of paths) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
  }

  /**
   * FFmpeg komutunu spawn ile çalıştır.
   * Stream tabanlı — maxBuffer limiti yok, büyük video dosyalarında güvenli.
   * @param {string[]} args  ffmpeg CLI argümanları
   * @returns {Promise<void>}
   */
  _exec(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      const stderrChunks = [];
      proc.stderr.on('data', (chunk) => stderrChunks.push(chunk));

      proc.on('error', (err) => {
        reject(new Error(`FFmpeg spawn failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString().slice(-500);
          logger.error(`FFmpeg hata (code ${code}): ${stderr}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }
        resolve();
      });
    });
  }

  /* ───────────────────────── resim işlemleri ───────────────────────────── */

  /**
   * Resim → JPEG'e dönüştür + çözünürlük düşür (en-boy oranı korunur).
   *
   * @param {Buffer}  inputBuffer
   * @param {Object}  [opts]
   * @param {number}  [opts.maxWidth]
   * @param {number}  [opts.maxHeight]
   * @param {number}  [opts.quality]   qscale:v 2-31
   * @returns {Promise<Buffer>}
   */
  async processImage(inputBuffer, opts = {}) {
    const maxW = opts.maxWidth  || this.imageMaxWidth;
    const maxH = opts.maxHeight || this.imageMaxHeight;
    const q    = opts.quality   || this.imageQuality;

    const inputPath  = this._writeTmp(inputBuffer, '.input');
    const outputPath = path.join(this.tmpDir, `chatterbox_${uuidv4()}.jpg`);

    try {
      await this._exec([
        '-y',
        '-i', inputPath,
        '-vf', `scale='min(${maxW},iw)':'min(${maxH},ih)':force_original_aspect_ratio=decrease`,
        '-qscale:v', String(q),
        '-frames:v', '1',
        '-an',
        outputPath,
      ]);

      return fs.readFileSync(outputPath);
    } finally {
      this._cleanup(inputPath, outputPath);
    }
  }

  /**
   * Avatar: center-crop + kare boyut + JPEG
   *
   * @param {Buffer}  inputBuffer
   * @param {number}  [size=256]
   * @returns {Promise<Buffer>}
   */
  async processAvatar(inputBuffer, size) {
    const s = size || this.avatarSize;

    const inputPath  = this._writeTmp(inputBuffer, '.input');
    const outputPath = path.join(this.tmpDir, `chatterbox_${uuidv4()}.jpg`);

    try {
      await this._exec([
        '-y',
        '-i', inputPath,
        '-vf', `scale=${s}:${s}:force_original_aspect_ratio=increase,crop=${s}:${s}`,
        '-qscale:v', '3',
        '-frames:v', '1',
        '-an',
        outputPath,
      ]);

      return fs.readFileSync(outputPath);
    } finally {
      this._cleanup(inputPath, outputPath);
    }
  }

  /* ───────────────────────── video işlemleri ───────────────────────────── */

  /**
   * Video → MP4 (H.264/AAC), çözünürlük ≤ maxHeight, fast-start.
   *
   * @param {Buffer}  inputBuffer
   * @param {Object}  [opts]
   * @param {number}  [opts.maxHeight=720]
   * @returns {Promise<Buffer>}
   */
  async processVideo(inputBuffer, opts = {}) {
    const maxH = opts.maxHeight || this.videoMaxHeight;

    const inputPath  = this._writeTmp(inputBuffer, '.mp4');
    const outputPath = path.join(this.tmpDir, `chatterbox_${uuidv4()}.mp4`);

    try {
      await this._exec([
        '-y',
        '-i', inputPath,
        '-vf', `scale=-2:'min(${maxH},ih)'`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputPath,
      ]);

      return fs.readFileSync(outputPath);
    } finally {
      this._cleanup(inputPath, outputPath);
    }
  }

  /**
   * Videodan thumbnail (ilk kare) → JPEG
   *
   * @param {Buffer}  inputBuffer
   * @param {Object}  [opts]
   * @param {number}  [opts.width=320]
   * @returns {Promise<Buffer>}
   */
  async generateThumbnail(inputBuffer, opts = {}) {
    const width = opts.width || 320;

    const inputPath  = this._writeTmp(inputBuffer, '.mp4');
    const outputPath = path.join(this.tmpDir, `chatterbox_${uuidv4()}_thumb.jpg`);

    try {
      await this._exec([
        '-y',
        '-i', inputPath,
        '-vf', `scale=${width}:-1`,
        '-qscale:v', '5',
        '-frames:v', '1',
        '-an',
        outputPath,
      ]);

      return fs.readFileSync(outputPath);
    } finally {
      this._cleanup(inputPath, outputPath);
    }
  }

  /* ───────────────────────── probe (metadata) ─────────────────────────── */

  /**
   * FFprobe ile dosya metadata'sı (süre, çözünürlük, codec vb.)
   */
  async probe(inputBuffer, ext = '.mp4') {
    const inputPath = this._writeTmp(inputBuffer, ext);

    try {
      return await new Promise((resolve, reject) => {
        const proc = spawn(
          this.ffprobePath,
          ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        const stdoutChunks = [];
        proc.stdout.on('data', (chunk) => stdoutChunks.push(chunk));

        proc.on('error', (err) => reject(err));

        proc.on('close', (code) => {
          if (code !== 0) return reject(new Error(`FFprobe exited with code ${code}`));
          try {
            resolve(JSON.parse(Buffer.concat(stdoutChunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
      });
    } finally {
      this._cleanup(inputPath);
    }
  }
}

module.exports = MediaService;

