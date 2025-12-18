import CryptoJS from "crypto-js";

const decryptVpsPassword = async (encryptedPassword: string): Promise<string> => {
    // 2. Decrypt returns a WordArray. Do NOT call .toString() here yet.
    const decryptedBytes =await CryptoJS.AES.decrypt(encryptedPassword, process.env.ENCRYPTION_KEY as string);

    // 3. Convert the WordArray to a UTF-8 string
    const decrypted = decryptedBytes.toString(CryptoJS.enc.Utf8);

    return decrypted;
}
export default decryptVpsPassword;