# AES-NodeJs(ECB\CBC\CFB)

```javascript
import crypto from 'crypto';

/**
 *
 */
class CryptoUtil {
  /**
   * 加密
   */
  static encrypt(data, secretKey) {
    const iv = '';
    const clearEncoding = 'utf8';
    const cipherEncoding = 'hex';
    const cipherChunks: string[] = [];
    const cipher = crypto.createCipheriv('aes-128-ecb', secretKey, iv);
    cipher.setAutoPadding(true);

    cipherChunks.push(cipher.update(data, clearEncoding, cipherEncoding));
    cipherChunks.push(cipher.final(cipherEncoding));
    return cipherChunks.join('');
  }

  /**
   * 解密
   */
  static decrypt(data, secretKey) {
    const iv = '';
    const clearEncoding = 'utf8';
    const cipherEncoding = 'hex';
    const cipherChunks: string[] = [];
    const decipher = crypto.createDecipheriv('aes-128-ecb', secretKey, iv);
    decipher.setAutoPadding(true);

    cipherChunks.push(decipher.update(data, cipherEncoding, clearEncoding));
    cipherChunks.push(decipher.final(clearEncoding));

    return cipherChunks.join('');
  }

  /**
   * test
   */
  static test() {
    let data = {
      deviceId: '1a8675f0ecc847eec99d1c7f44503a79',
      UserId: '1a8675f0ecc847eec99d1c7f44503a79',
    };
    let secretKey = '1234567890123456';
    let encrypted = this.encrypt(JSON.stringify(data), secretKey);
    let decrypted = this.decrypt(encrypted, secretKey);

    console.log('明文' + JSON.stringify(data));
    console.log('加密后' + encrypted);
    console.log('解密后' + JSON.parse(decrypted).UserId);
  }
}

export default CryptoUtil;

```