import { Router } from "express";
import { UpdateMetadataSchema } from "../../types";
import { userMiddleware } from "../../middleware/user";
import client from "@repo/db/client";


export const userRouter: Router = Router();

userRouter.post("/metadata", userMiddleware, async (req, res) => {
    const parsedData = UpdateMetadataSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" })
        return
    }

    try{
    await client.user.update({
        where: {
            id: req.userId
        }, data: {
            avatarId: parsedData.data.avatarId
        }
    })
    res.status(200).json({ message: "Metadata updated" })
    return
}catch(error){
    console.error("Error updating user metadata:",error);
    res.status(500).json({
        message:"Internal server error",
        error:error instanceof Error ? error.message: "Unknown error"
    })
}
})

userRouter.get("/metadata/bulk", async(req,res) => {
    const userIdString = (req.query.ids ?? "[]") as string;
    const userIds = (userIdString).slice(1,userIdString?.length - 2).split(",");
        
    const metadata = await client.user.findMany({
        where:{
            id:{
                in:userIds
            }
        },select:{
            avatar:true,
            id:true
        }
    })
   res.json({
    avatars: metadata.map(m => ({
        userId: m.id,
        avatarId: m.avatar?.imageUrl
    }))
   })
   return
})