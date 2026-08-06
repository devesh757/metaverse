import { Router } from "express"
import { userRouter } from "./user";
import { spaceRouter } from "./space";
import { adminRouter } from "./admin";
import { SigninSchema, SignupSchema } from "../../types";
import client from "@repo/db/client";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { JWT_PASSWORD } from "../../config";

export const router: Router = Router();

router.post("/signup", async (req, res) => {

   const parsedData = SignupSchema.safeParse(req.body)

   if (!parsedData.success) {
      return res.status(400).json({ message: "Validation failed" })
   }
   const hashedPassword = await bcrypt.hash(parsedData.data.password, 10)
   try {
      const user = await client.user.create({
         data: {
            username: parsedData.data.username,
            password: hashedPassword,
            role: parsedData.data.type === "admin" ? "Admin" : "User",
         }
      })
      res.status(200).json({
         message:"user created successfully",
         userId: user.id
      })
   } catch (e) {
      res.status(500).json({ message: "User already exists" })
   }
})

router.post("/signin", async (req, res) => {
   const parsedData = SigninSchema.safeParse(req.body)
   if (!parsedData.success) {
      res.status(403).json({ message: "Validation failed" })
      return
   }

   try {
      const user = await client.user.findUnique({
         where: {
            username: parsedData.data.username
         }
      })
      if (!user) {
         res.status(403).json({ message: "User not found" })
         return
      }
      const isValid = await bcrypt.compare(parsedData.data.password, user.password)
      if (!isValid) {
         res.status(403).json({ message: "Invalid password" })
         return
      }

      const token = jwt.sign({
         userId: user.id,
         role: user.role
      }, JWT_PASSWORD);
      res.json({
         token: token
      })
   } catch (e) {
      res.status(500).json({
         message: "Internal server error"
      })
      return
   }
})

router.get("/elements", async (req, res) => {
 const elements = await client.element.findMany()
 res.status(200).json({elements:elements.map((element) => ({
   id:element.id,
   imageUrl: element.imageUrl,
   width:element.width,
   height:element.height,
   static:element.static
 }))})
})

router.get("/avatar", async(req, res) => {
const avatars = await client.avatar.findMany()
res.json({avatars:avatars.map(x =>({
   id:x.id,
   imageUrl: x.imageUrl,
   name: x.name
}))})
})

router.use("/user", userRouter)
router.use("/space", spaceRouter)
router.use("/admin", adminRouter)