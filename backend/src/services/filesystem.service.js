/**
 * FilesystemService
 *
 * Dosya depolama işlemleri için provider-agnostic servis katmanı.
 * Hangi provider kullanılacağı dışarıdan enjekte edilir (DI).
 *
 * Mevcut provider: MinioStorageProvider
 * S3'e geçiş     : S3StorageProvider oluşturup container.js'de enjekte edin.
 *
 * Provider interface:
 *   init()                                → Promise<void>
 *   upload(objectName, buffer, mimeType)  → Promise<string>
 *   getStream(objectName)                 → Promise<{ stream, contentType, size }>
 *   delete(objectName)                    → Promise<void>
 *   extractObjectName(url)                → string | null
 */

class FilesystemService {
  /**
   * @param {{ storageProvider: object }} deps
   */
  constructor({ storageProvider }) {
    this.provider = storageProvider;
  }

  /**
   * Provider'ı başlatır (bucket oluşturma, bağlantı kontrolü vb.).
   * Uygulama başlangıcında çağrılmalıdır.
   */
  async init(options) {
    return this.provider.init(options);
  }

  /**
   * Buffer'ı depolama alanına yükler.
   * @param {string} objectName  — dosyanın depolanacağı yol/isim (ör: images/uuid.jpg)
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @returns {Promise<string>} Erişim URL'i
   */
  async upload(objectName, buffer, mimeType) {
    return this.provider.upload(objectName, buffer, mimeType);
  }

  /**
   * Dosyayı stream olarak döner.
   * @param {string} objectName
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, size: number }>}
   */
  async getStream(objectName) {
    return this.provider.getStream(objectName);
  }

  /**
   * Dosyayı depolama alanından siler.
   * @param {string} objectName
   */
  async delete(objectName) {
    return this.provider.delete(objectName);
  }

  /**
   * Herhangi bir URL'den object name'i çıkarır.
   * @param {string} url
   * @returns {string | null}
   */
  extractObjectName(url) {
    return this.provider.extractObjectName(url);
  }
}

module.exports = FilesystemService;

