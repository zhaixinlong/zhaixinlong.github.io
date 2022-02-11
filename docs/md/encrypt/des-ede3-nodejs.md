# DES-EDE3 for NodeJs 

# 京东支付 加密方式 
```javascript
class JdPay {
  private static rsaSign(str) {
    const shaStr: string = crypto
      .createHash('SHA256')
      .update(str)
      .digest('hex');

    const privateKeyPath = path.resolve(__dirname, './cert/jdpay/test_jd_rsa_private_key_pkcs8_key.pem');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    return crypto.privateEncrypt(privateKey, Buffer.from(shaStr, 'utf8')).toString('base64');
  }

  private static number2Bytes(i) {
    const buf: Buffer = Buffer.alloc(4);
    buf.writeInt32BE(i, 0);
    return buf;
  }

  /*** base64编码
   * * @param text
   * * @returns {Buffer}
   * */
  private static base64(text) {
    return Buffer.from(text, 'base64');
  }

  /*** 加密**
   *   @param text
   * * @param secretKey
   * * @returns {string}
   * */
  private static encode(text, secretKey): string {
    secretKey = this.base64(secretKey);

    // DESede/ECB/NoPaddings  pkcs7 is pkcs5
    const cipher = crypto.createCipheriv('des-ede3', secretKey, Buffer.alloc(0));
    cipher.setAutoPadding(false); //the crypto module uses pkcs7 padding default, need set auto padding false , padding yourself. leave task you.
    const encrypted = cipher.update(text, 'utf8', 'hex');
    return encrypted + cipher.final('hex'); // final的作用是收尾，因为update之后会有一些剩余没有加密的数据，只有调用了这个才算是对整个数据源进行加密
  }

  /*** 解密*
   * @param encryptedBase64
   * * @param secretKey
   * * @returns {string}
   * */
  private static decode(encrypted, secretKey): Buffer {
    secretKey = this.base64(secretKey);

    // DESede/ECB/NoPaddings  pkcs7 is pkcs5
    const decipher = crypto.createDecipheriv('des-ede3', secretKey, Buffer.alloc(0));
    decipher.setAutoPadding(false); //the crypto module uses pkcs7 padding default, need set auto padding false , padding yourself. leave task you.
    let decrypted = decipher.update(encrypted, 'hex', 'binary');
    decrypted = decrypted + decipher.final('binary'); // final的作用是收尾，因为update之后会有一些剩余没有加密的数据，只有调用了这个才算是对整个数据源进行加密

    return Buffer.from(decrypted, 'binary');
  }

  private static jdPayEncode(plainText: string): string {
    // 元数据
    const source = Buffer.from(plainText);
    // logger.deug('原数据source hex:' + Buffer.from(plainText).toString('hex'));

    // 1.原数据byte长度
    const merchantData = source.length;
    // logger.deug('原数据byte长度:' + merchantData);
    // logger.deug('\n' + this.number2Bytes(merchantData));

    // 2.计算补位
    const x = (merchantData + 4) % 8;
    const y = x == 0 ? 0 : 8 - x;

    // logger.deug('需要补位 :' + y);

    // 3.将有效数据长度byte[]添加到原始byte数组的头部
    const sizeByte = this.number2Bytes(merchantData);
    const resultByte = Buffer.alloc(4 + merchantData + y);

    for (let i = 0; i < 4; i++) {
      resultByte[i] = sizeByte[i];
    }

    //var_dump($sizeByte);
    // 4.填充补位数据
    for (let j = 0; j < merchantData; j++) {
      resultByte[4 + j] = source[j];
    }

    //var_dump($resultByte);
    for (let k = 0; k < y; k++) {
      resultByte[merchantData + 4 + k] = 0x00;
    }

    // logger.deug('补位后的byte数组长度:' + resultByte.length);

    // logger.deug('补位后的byte str: ', resultByte.toString());

    // logger.deug('补位后的byte hex: ', resultByte.toString('hex'));

    const encrypted = this.encode(resultByte, config.jdpay.desKey);

    return Buffer.from(encrypted).toString('base64');
  }

  private static jdPayDecode(base64Str: string): string {
    // base decode to hex
    const hexStr = Buffer.from(base64Str, 'base64').toString('ascii');

    // hex str to buffer
    const unDesResultByte = this.decode(hexStr, config.jdpay.desKey);

    const dataSizeByte = Buffer.alloc(4);
    for (let i = 0; i < 4; i++) {
      dataSizeByte[i] = unDesResultByte[i];
    }

    // 有效数据长度
    const dsb = dataSizeByte.readInt32BE(0);

    const tempData = Buffer.alloc(dsb);
    for (let j = 0; j < dsb; j++) {
      tempData[j] = unDesResultByte[4 + j];
    }
    return tempData.toString();
  }
}
```