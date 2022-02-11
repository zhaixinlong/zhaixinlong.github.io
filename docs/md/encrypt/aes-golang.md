# AES-Golang(ECB\CBC\CFB)

# example
```golang
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
)

type EncryptData struct {
	DeviceId string `json:"deviceId"`
	UserId   string `json:"userId"`
}

func main() {
	origData := []byte("Hello World") // 待加密的数据
	key := []byte("1234567890123456") // 加密的密钥
	log.Println("原文：", string(origData))

	log.Println("------------------ ECB模式 --------------------")
	encryptDataInput := &EncryptData{
		DeviceId: "1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532",
		UserId:   "1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532",
	}

	encryptedStr, err := EncryptEncryptData(encryptDataInput, key)
	if err != nil {
		panic(err)
	}
	log.Println("encryptedStr:", encryptedStr)

	decryptedData, err := DecryptEncryptData(encryptedStr, key)
	if err != nil {
		panic(err)
	}
	log.Println("decryptedData:", decryptedData)

	log.Println("------------------ ECB模式 --------------------")
	b, err := json.Marshal(decryptedData)
	if err != nil {
		panic(err)
	}

	origData = b
	encrypted := AesEncryptECB(origData, key)
	pds := hex.EncodeToString(encrypted)
	log.Println("密文(hex)：", pds)

	pdb, _ := hex.DecodeString(pds)
	decrypted := AesDecryptECB(pdb, key)
	log.Println("解密结果：", string(decrypted))

	var encryptData EncryptData
	err = json.Unmarshal(decrypted, &encryptData)
	if err != nil {
		log.Println("parse data error %v \n", err)
		return
	}
	log.Println("解密结果：%v", encryptData)

	log.Println("------------------ CBC模式 --------------------")
	encrypted = AesEncryptCBC(origData, key)
	log.Println("密文(hex)：", hex.EncodeToString(encrypted))
	log.Println("密文(base64)：", base64.StdEncoding.EncodeToString(encrypted))
	decrypted = AesDecryptCBC(encrypted, key)
	log.Println("解密结果：", string(decrypted))

	log.Println("------------------ CFB模式 --------------------")
	encrypted = AesEncryptCFB(origData, key)
	log.Println("密文(hex)：", hex.EncodeToString(encrypted))
	log.Println("密文(base64)：", base64.StdEncoding.EncodeToString(encrypted))
	decrypted = AesDecryptCFB(encrypted, key)
	log.Println("解密结果：", string(decrypted))
}

func EncryptEncryptData(saData *EncryptData, key []byte) (string, error) {
	origData, err := json.Marshal(saData)
	if err != nil {
		return "", err
	}

	encrypted := AesEncryptECB(origData, key)
	pds := hex.EncodeToString(encrypted)
	return pds, nil
}

func DecryptEncryptData(pds string, key []byte) (*EncryptData, error) {
	pdb, _ := hex.DecodeString(pds)
	decrypted := AesDecryptECB(pdb, key)

	var saData *EncryptData
	err := json.Unmarshal(decrypted, &saData)
	if err != nil {
		return nil, err
	}
	return saData, nil
}

// =================== CBC ======================
func AesEncryptCBC(origData []byte, key []byte) (encrypted []byte) {
	// 分组秘钥
	// NewCipher该函数限制了输入k的长度必须为16, 24或者32
	block, _ := aes.NewCipher(key)
	blockSize := block.BlockSize()                              // 获取秘钥块的长度
	origData = pkcs5Padding(origData, blockSize)                // 补全码
	blockMode := cipher.NewCBCEncrypter(block, key[:blockSize]) // 加密模式
	encrypted = make([]byte, len(origData))                     // 创建数组
	blockMode.CryptBlocks(encrypted, origData)                  // 加密
	return encrypted
}
func AesDecryptCBC(encrypted []byte, key []byte) (decrypted []byte) {
	block, _ := aes.NewCipher(key)                              // 分组秘钥
	blockSize := block.BlockSize()                              // 获取秘钥块的长度
	blockMode := cipher.NewCBCDecrypter(block, key[:blockSize]) // 加密模式
	decrypted = make([]byte, len(encrypted))                    // 创建数组
	blockMode.CryptBlocks(decrypted, encrypted)                 // 解密
	decrypted = pkcs5UnPadding(decrypted)                       // 去除补全码
	return decrypted
}

func pkcs5Padding(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}
func pkcs5UnPadding(origData []byte) []byte {
	length := len(origData)
	unpadding := int(origData[length-1])
	return origData[:(length - unpadding)]
}

// =================== ECB ======================
func AesEncryptECB(origData []byte, key []byte) (encrypted []byte) {
	cipher, _ := aes.NewCipher(generateKey(key))
	length := (len(origData) + aes.BlockSize) / aes.BlockSize
	plain := make([]byte, length*aes.BlockSize)
	copy(plain, origData)
	pad := byte(len(plain) - len(origData))
	for i := len(origData); i < len(plain); i++ {
		plain[i] = pad
	}
	encrypted = make([]byte, len(plain))
	// 分组分块加密
	for bs, be := 0, cipher.BlockSize(); bs <= len(origData); bs, be = bs+cipher.BlockSize(), be+cipher.BlockSize() {
		cipher.Encrypt(encrypted[bs:be], plain[bs:be])
	}

	return encrypted
}
func AesDecryptECB(encrypted []byte, key []byte) (decrypted []byte) {
	cipher, _ := aes.NewCipher(generateKey(key))
	decrypted = make([]byte, len(encrypted))
	//
	for bs, be := 0, cipher.BlockSize(); bs < len(encrypted); bs, be = bs+cipher.BlockSize(), be+cipher.BlockSize() {
		cipher.Decrypt(decrypted[bs:be], encrypted[bs:be])
	}

	trim := 0
	if len(decrypted) > 0 {
		trim = len(decrypted) - int(decrypted[len(decrypted)-1])
	}

	return decrypted[:trim]
}
func generateKey(key []byte) (genKey []byte) {
	genKey = make([]byte, 16)
	copy(genKey, key)
	for i := 16; i < len(key); {
		for j := 0; j < 16 && i < len(key); j, i = j+1, i+1 {
			genKey[j] ^= key[i]
		}
	}
	return genKey
}

// =================== CFB ======================
func AesEncryptCFB(origData []byte, key []byte) (encrypted []byte) {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}
	encrypted = make([]byte, aes.BlockSize+len(origData))
	iv := encrypted[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		panic(err)
	}
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(encrypted[aes.BlockSize:], origData)
	return encrypted
}
func AesDecryptCFB(encrypted []byte, key []byte) (decrypted []byte) {
	block, _ := aes.NewCipher(key)
	if len(encrypted) < aes.BlockSize {
		panic("ciphertext too short")
	}
	iv := encrypted[:aes.BlockSize]
	encrypted = encrypted[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(encrypted, encrypted)
	return encrypted
}
```

# resullt console
> // 2022/02/11 15:10:48 原文： Hello World
> // 2022/02/11 15:10:48 ------------------ ECB模式 --------------------
// 2022/02/11 15:10:48 encryptedStr: 8c0f3d2b1517472839aa06d16800129a27819f629a02cec9f39de4501242829d500928211f20147190f4e120727478cb92c0349eaaceffbdf03e25baa10a7fb4b950be10053cd973013f0d0750fbdc9a7957636e52788a2716b7fec3ca709848090a7c701b351d178508ca028096de2211c1a290be2b87be3cb8dc52c90c8c555c8726c0d5b6c7e58382e17e9efb54f7cd8fefb2d6aa76d37995ccc25fece3e7
> // 2022/02/11 15:10:48 decryptedData: &{1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532 1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532}
> // 2022/02/11 15:10:48 ------------------ ECB模式 --------------------
// 2022/02/11 15:10:48 密文(hex)： 8c0f3d2b1517472839aa06d16800129a27819f629a02cec9f39de4501242829d500928211f20147190f4e120727478cb92c0349eaaceffbdf03e25baa10a7fb4b950be10053cd973013f0d0750fbdc9a7957636e52788a2716b7fec3ca709848090a7c701b351d178508ca028096de2211c1a290be2b87be3cb8dc52c90c8c555c8726c0d5b6c7e58382e17e9efb54f7cd8fefb2d6aa76d37995ccc25fece3e7
> // 2022/02/11 15:10:48 解密结果： {"deviceId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532","userId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532"}
> // 2022/02/11 15:10:48 解密结果：%v {1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532 1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532}
> // 2022/02/11 15:10:48 ------------------ CBC模式 --------------------
> // 2022/02/11 15:10:48 密文(hex)： 1a7c6fe9bb38b01315c07317def36e5ba321f10e9034a1be8653e1cf6d15a33f8005bb8c73a0494315391255a64a6b431861fc0ced26ad645d5839f582336fd2ed4153d51c862c1e8de4756426d57300089132b424bda4c0606f8f933009696a6b8e809afe9b7df074d6bf630208bdb169904fd3a8f25a85293244f986ac82f42707b1619eab93aa0f993e4c6a4a3df926d9924f85007b8a8c031ed31dfc71ee
> // 2022/02/11 15:10:48 密文(base64)： Gnxv6bs4sBMVwHMX3vNuW6Mh8Q6QNKG+hlPhz20Voz+ABbuMc6BJQxU5ElWmSmtDGGH8DO0mrWRdWDn1gjNv0u1BU9UchiwejeR1ZCbVcwAIkTK0JL2kwGBvj5MwCWlqa46Amv6bffB01r9jAgi9sWmQT9Oo8lqFKTJE+YasgvQnB7FhnquTqg+ZPkxqSj35JtmST4UAe4qMAx7THfxx7g==
> // 2022/02/11 15:10:48 解密结果： {"deviceId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532","userId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532"}
> // 2022/02/11 15:10:48 ------------------ CFB模式 --------------------
> // 2022/02/11 15:10:48 密文(hex)： 48a6080af19c330499a684f68d760a67e88e442b8c06e696c67bc7320e7ad070d15728d581e29e0d3e37224cdce6b69736339d94046f5c023fb6d3d79522cbccdb84adc92b78df2c600a9626690a4b107f23fb6248578144b6c57b7b09bc0649fbdead8d724d9056df823173689d815db171b1f8c9387be5d2bcf7bf373f408dfd94044fee6de7c257d674d476cc718e93fd33004283d3de402b48518fa89df9519727c155
> // 2022/02/11 15:10:48 密文(base64)： SKYICvGcMwSZpoT2jXYKZ+iORCuMBuaWxnvHMg560HDRVyjVgeKeDT43Ikzc5raXNjOdlARvXAI/ttPXlSLLzNuErckreN8sYAqWJmkKSxB/I/tiSFeBRLbFe3sJvAZJ+96tjXJNkFbfgjFzaJ2BXbFxsfjJOHvl0rz3vzc/QI39lARP7m3nwlfWdNR2zHGOk/0zAEKD095AK0hRj6id+VGXJ8FV
> // 2022/02/11 15:10:48 解密结果： {"deviceId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532","userId":"1750afc13ea653-068a722c6c4a9c-19396153-2073600-1750afc13eb532"}