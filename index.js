import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from "cors"
import 'dotenv/config'

const app = express()
const port = 8000

app.use(cors());
app.use(express.json())

const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const  mongoClient = await connectToMongoDB()
const db =mongoClient.db("booknook")
const bookcollection= db.collection("book")


app.post("/add-book",async(req,res)=>{
     const data = req.body 
     const result = await bookcollection.insertOne(data)
     console.log(result)
     res.send(result)
})
app.get("/books",async(req,res)=>{
     const result =  await bookcollection.find().toArray()
     res.send(result)

})
app.get("/book/:id",async(req,res)=>{
     const {id} = req.params
     const result = await bookcollection.findOne({_id:id    })
     res.send(result)
      
}) 
app.get("/my-books/:email", async (req, res) => {
const { email } = req.params;
const result = await bookcollection.find({ userEmail: email }).toArray();
res.send(result);
});

app.patch("/my-book/:id",async(req,res)=>{
     const {id}= req.params
     const updateData = req.body
     const  result = await bookcollection.updateOne(
          {_id:new ObjectId(id)},
          {$set:updateData}
     )
     res.json(result)
})

app.delete("/my-book/:id",async(req,res)=>{
     const {id}=req.params
     const result = await  bookcollection.deleteOne({_id:new ObjectId(id)})
     res.json(result)
})

app.get("/",(req,res)=>{
     res.send({message:"Server is Running fine!"})
})
app.listen(port,()=>{
     console.log(`Example app listening on port ${port}`)
})