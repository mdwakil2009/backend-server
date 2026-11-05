import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      message: "Unauthorized! Token is missing.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);

    return res.status(401).send({
      message: "Invalid or expired token!",
    });
  }
};
app.post("/add-book",verifyToken, async (req, res) => {
  const data = req.body;
  const result = await bookcollection.insertOne(data);
  console.log(result);
  res.send(result);
});
app.get("/arrivals", async (req, res) => {
  const result = await bookcollection.find().skip(12).limit(12).toArray();
  res.send(result);
});
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
  try {
    const result = await bookcollection.findOne({
      _id: req.params.id,
    });

    if (!result) {
      return res.status(404).send({ message: "Book Not Found" });
    }

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to load book details" });
  }
});
app.get("/my-books/:email",verifyToken, async (req, res) => {
  const { email } = req.params;
  const result = await bookcollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.patch("/my-book/:id",verifyToken, async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const result = await bookcollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData },
  );
  res.json(result);
});

app.delete("/my-book/:id",verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await bookcollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});
app.post("/borrows", verifyToken, async (req, res) => {
  try {
    const data = req.body;
    const { bookId, userEmail } = data;

    if (!bookId || !userEmail) {
      return res.status(400).send({ message: "Book ID and email are required!" });
    }

    // Check if the user already borrowed this book
    const alreadyBorrowed = await borrowscollection.findOne({
      bookId,
      userEmail,
    });

    if (alreadyBorrowed) {
      return res.status(409).send({
        message: "You have already borrowed this book!",
      });
    }

    // Find book
    const book = await bookcollection.findOne({ _id: bookId });

    if (!book) {
      return res.status(404).send({ message: "Book not found!" });
    }

    // Use availableCopies, or totalCopies if availableCopies does not exist
    const availableCopies = book.availableCopies ?? book.totalCopies ?? 0;

    if (availableCopies <= 0) {
      return res.status(400).send({ message: "No copies available!" });
    }

    // Decrease available copies
    const updateResult = await bookcollection.updateOne(
      {
        _id: bookId,
        $expr: {
          $gt: [
            { $ifNull: ["$availableCopies", "$totalCopies"] },
            0,
          ],
        },
      },
      [
        {
          $set: {
            availableCopies: {
              $subtract: [
                { $ifNull: ["$availableCopies", "$totalCopies"] },
                1,
              ],
            },
          },
        },
      ]
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).send({ message: "No copies available!" });
    }

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
app.delete("/borrow/:id",verifyToken, async (req, res) => {
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
export default app;