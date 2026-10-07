import crypto from "crypto";

export class OtpUtil {
  static generateNumericOTP(length: number = 6): string {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
      otp += digits[crypto.randomInt(0, digits.length)];
    }
    return otp;
  }
}
