import { Router } from "express";
import { adminMiddleware } from "../../middleware/admin";
import { AddElementSchema, CreateAvtarSchema, CreateElementSchema, CreateMapSchema, UpdateElementSchema } from "../../types";
import client from "@repo/db/client";



export const adminRouter: Router = Router();

adminRouter.post("/element", adminMiddleware, async (req, res) => {
    const parsedData = CreateElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" })
        return
    }
    try {
        const element = await client.element.create({
            data: {
                width: parsedData.data.width,
                height: parsedData.data.height,
                static: parsedData.data.static,
                imageUrl: parsedData.data.imageUrl,
            }
        })
        res.status(201).json({
            id: element.id,
            message: "Element created successfully"
        });
    } catch (e) {
        return res.status(500).json({
            message: "Internal Server error"
        })
    }
})

adminRouter.put("/element/:elementId", async(req, res) => {

    const { elementId } = req.params;
    const parsedData = UpdateElementSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" })
        return
    }
   const element = await client.element.update({
        where: {
            id: elementId
        },
        data: {
            imageUrl: parsedData.data.imageUrl
        }
    })
    res.status(200).json({ message: "Element updated" ,
        id:element.id
    })
})

adminRouter.post("/avatar",async(req, res) => {
 const parsedData = CreateAvtarSchema.safeParse(req.body)
 if(!parsedData.success){
    res.status(400).json({message:"Validation failed"})
    return
 }  

 try{
 const avatar = await client.avatar.create({
    data:{
        name:parsedData.data.name,
        imageUrl:parsedData.data.imageUrl
    }
 })
 res.status(201).json({
    message:"Avatar created successfully",
    id:avatar.id})

}catch(error){
return res.status(500).json({
    message:"Internal server error"
})
}
})

adminRouter.post("/map", async(req, res) => {
    const parsedData = CreateMapSchema.safeParse(req.body)
    if(!parsedData.success){
        res.status(400).json({message:"Validation failed"})
        return
    }
    try{
    const map = await client.map.create({
        data:{
            name:parsedData.data.name,
            width:parseInt(parsedData.data.dimensions.split("x")[0]!),
            height:parseInt(parsedData.data.dimensions.split("x")[1]!),
            thumbnail:parsedData.data.thumbnail,
            mapElements:{
                create:parsedData.data.defaultElements.map(e => ({
                    elementId:e.elementId,
                    x:e.x,
                    y:e.y
                }))
            }
        }
    })
    res.json({
        id:map.id
    })
}catch(error){
    console.error("Error creating map:",error);
    return res.status(500).json({
        message:"Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
    })
}
})
