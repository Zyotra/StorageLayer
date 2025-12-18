import jwt from "jsonwebtoken";

export const verifyAccessToken = async (token: string)=> {
    try {
        const user = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as {userId: string};
        console.log("Decoded token payload:", user);
        return{ userId: user.userId };
    } catch (error) {
        return false;
    }
}