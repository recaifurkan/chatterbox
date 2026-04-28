/**
 * SocketService
 *
 * Socket.IO broadcast işlemleri için servis katmanı.
 * Servisler doğrudan getIO() çağırmaz; bu servis üzerinden event gönderir.
 *
 * Avantajlar:
 *   - Servislerde raw Socket.IO bağımlılığı yok → birim testlerde kolayca mock'lanabilir
 *   - Socket.IO'yu başka bir gerçek-zamanlı altyapıyla değiştirmek gerekirse
 *     sadece bu dosya değişir
 */

const { USER_KEY, ROOM_KEY } = require('../utils/constants');

class SocketService {
  /**
   * @param {{ getIO: () => import('socket.io').Server }} deps
   */
  constructor({ getIO }) {
    this._getIO = getIO;
  }

  /** @returns {import('socket.io').Server} */
  get io() {
    return this._getIO();
  }

  /**
   * Tüm bağlı istemcilere broadcast yapar.
   * @param {string} event
   * @param {object} data
   */
  emit(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Belirli bir kullanıcının socket odasına event gönderir.
   * (Oda adı: user:<userId>)
   * @param {string|object} userId
   * @param {string} event
   * @param {object} data
   */
  emitToUser(userId, event, data) {
    this.io.to(USER_KEY(userId.toString())).emit(event, data);
  }

  /**
   * Belirli bir odaya event gönderir.
   * (Oda adı: room:<roomId>)
   * @param {string|object} roomId
   * @param {string} event
   * @param {object} data
   */
  emitToRoom(roomId, event, data) {
    this.io.to(ROOM_KEY(roomId.toString())).emit(event, data);
  }
}

module.exports = SocketService;

