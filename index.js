import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

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
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("booknook");
const bookcollection = db.collection("book");
const borrowscollection = db.collection("borrows");

app.post("/add-book", async (req, res) => {
  const data = req.body;
  const result = await bookcollection.insertOne(data);
  console.log(result);
  res.send(result);
});
// app.get("/books", async (req, res) => {
//   const result = await bookcollection.find().toArray();
//   res.send(result);
// });
app.get("/arrivals",async(req,res)=>{
  const result = await bookcollection.find().limit(12).toArray()
  res.send(result)
})
app.get("/books", async (req, res) => {
  const category = req.query.category;

  let query = {};

  if (category) {
    query = { category: category };
  }

  const result = await bookcollection.find(query).toArray();

  res.send(result);
});
app.get("/book/:id", async (req, res) => {
  const { id } = req.params;
  const result = await bookcollection.findOne({ _id: id });
  res.send(result);
});
app.get("/my-books/:email", async (req, res) => {
  const { email } = req.params;
  const result = await bookcollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.patch("/my-book/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const result = await bookcollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData },
  );
  res.json(result);
});

app.delete("/my-book/:id", async (req, res) => {
  const { id } = req.params;
  const result = await bookcollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});
// http://localhost:8000//my-borrows
app.post("/borrows", async (req, res) => {
  try {
    const data = req.body;
    const { bookId, userEmail } = data;

    // Check if this user already borrowed this book
    const alreadyBorrowed = await borrowscollection.findOne({
      bookId: bookId,
      userEmail: userEmail,
    });

    if (alreadyBorrowed) {
      return res.status(409).send({
        message: "You have already borrowed this book!",
      });
    }

    // Check available copies
    const book = await bookcollection.findOne({
      _id: bookId,
    });

    if (!book) {
      return res.status(404).send({
        message: "Book not found!",
      });
    }

    if (book.availableCopies <= 0) {
      return res.status(400).send({
        message: "No copies available!",
      });
    }

    // Decrease available copies
    await bookcollection.updateOne(
      {
        _id: bookId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
      },
    );

    // Save borrow information
    const result = await borrowscollection.insertOne(data);

    res.status(201).send({
      success: true,
      message: "Book borrowed successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Borrow Error:", error);

    res.status(500).send({
      message: "Failed to borrow book!",
    });
  }
});

app.get("/my-borrows/:email", async (req, res) => {
  const { email } = req.params;
  const result = await borrowscollection.find({ userEmail: email }).toArray();
  res.send(result);
});
// Return Borrowed Book
app.delete("/borrow/:id", async (req, res) => {
  const { id } = req.params;
  const result = await borrowscollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.json(result);
});

app.get("/", (req, res) => {
  res.send({ message: "Server is Running fine!" });
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
