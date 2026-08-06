import { Router } from "express";
import {  AddElementSchema, CreateSpaceSchema, DeleteElementSchema } from "../../types";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";


export const spaceRouter = Router();

spaceRouter.post("/", userMiddleware, async (req, res) => {
    const parsedData = CreateSpaceSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({ message: "Validation failed" })
        return
    }
    if (!parsedData.data.mapId) {
       const space = await client.space.create({
            data: {
                name: parsedData.data.name,
                width: parseInt(parsedData.data.dimensions.split("x")[0]!),
                height: parseInt(parsedData.data.dimensions.split("x")[1]!),
                creatorId: req.userId!,
            }
        })
        res.status(201).json({ spaceId: space.id })
        return
    }

    const map = await client.map.findUnique({
        where: {
            id: parsedData.data.mapId
        }, select: {
            mapElements: true,
            width: true,
            height: true
        }
    })

    if (!map) {
        res.status(400).json({ message: "Map not found" })
        return
    }

    let space = await client.$transaction(async () => {
        const space = await client.space.create({
            data: {
                name: parsedData.data.name,
                width: map.width,
                height: map.height,
                creatorId: req.userId!,
            }
        });

        await client.spaceElements.createMany({
            data: map.mapElements.map(e => ({
                spaceId: space.id,
                elementId: e.elementId,
                x: e.x!,
                y: e.y!
            }))
        })

        return space;
    })
    res.status(200).json({ 
        spaceId: space.id,
        message:"Space created successfully"
     })

})

spaceRouter.delete("/element", userMiddleware,async(req, res) => {
  const parsedData = DeleteElementSchema.safeParse(req.body)
  if(!parsedData.success){
    res.status(400).json({message:"Validation failed"})
    return
  }

  const spaceElement = await client.spaceElements.findFirst({
     where:{
        id: parsedData.data.id
     },include:{
        space:true
     }
  })

  if(!spaceElement?.space.creatorId || spaceElement.space.creatorId !== req.userId) {
    res.status(403).json({message:"Unauthorized"})
    return
  }
  await client.spaceElements.delete({
    where:{
        id:parsedData.data.id
    }
  })
  res.status(200).json({message:"Element deleted from space successfully"})
})

spaceRouter.delete("/:spaceId",userMiddleware,async (req, res) => {
    const spaceId = String(req.params.spaceId);
   const space = await client.space.findUnique({
    where:{
        id:spaceId,
    },select:{
        creatorId:true
    },
   });
   if(!space){
    res.status(400).json({message:"Space not found"})
    return
   }
if(space.creatorId !== req.userId){
    res.status(403).json({message:"Unauthorized"})
    return
}
await client.spaceElements.deleteMany({
    where:{
        spaceId: spaceId
    }
})
await client.space.delete({
    where:{
        id:spaceId
    }
})
res.status(200).json({
    message:`Space with ID ${spaceId} deleted successfuuly`})
})

spaceRouter.get("/all",userMiddleware, async (req, res) => {
const spaces = await client.space.findMany({
   where:{
    creatorId:req.userId!
   }
});
res.json({
    spaces:spaces.map(s => ({
        id: s.id,
        name:s.name,
        thumbnail:s.thumbnail,
        dimensions: `${s.width}x${s.height}`,
    }))
})
})

spaceRouter.post("/element",userMiddleware,async (req, res) => {
 const parsedData = AddElementSchema.safeParse(req.body)
 if(!parsedData.success){
 res.status(400).json({message:"Validation failed"})
 return
 } 
 const space = await client.space.findUnique({
    where:{
        id:req.body.spaceId,
        creatorId:req.userId!
    },select:{
        width: true,
        height: true
    }
 })

 if(!space){
    res.status(400).json({message:"space not found"})
    return
 }

await client.spaceElements.create({
    data:{
        spaceId:req.body.spaceId,
        elementId: req.body.elementId,
        x: req.body.x,
        y:req.body.y
    }
})
res.status(200).json({message:"Element Added"})
})

spaceRouter.get("/:spaceId", async(req, res) => {
   const { spaceId } = req.params;
  const space = await client.space.findUnique({
    where: {
      id: spaceId,
    },
    include: {
      elements: {
        include: {
          element: true,
        },
      },
    },
  });
  if (!space) {
    return res.status(404).json({
      message: "Space not found",
    });
  }

  res.status(200).json({
    dimensions: `${space.width}x${space.height}`,
    elements: space.elements.map((element) => ({
      id: element.id,
      element: {
        id: element.element.id,
        width: element.element.width,
        height: element.element.height,
        imageUrl: element.element.imageUrl,
        static: element.element.static,
      },
      x: element.x,
      y: element.y,
    })),
  });
})
