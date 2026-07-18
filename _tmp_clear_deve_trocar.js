const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const client = new MongoClient(
    'mongodb://root:MongoDB2019%21@localhost:27017/MundoSmart?authSource=admin'
  );
  await client.connect();
  const col = client.db('MundoSmart').collection('usuarios');
  const r = await col.updateOne(
    { _id: new ObjectId('6a5a5ab7e0350e32e57a889a') },
    { $set: { deveTrocarSenha: false } }
  );
  console.log(JSON.stringify({ matched: r.matchedCount, modified: r.modifiedCount }));
  const doc = await col.findOne(
    { _id: new ObjectId('6a5a5ab7e0350e32e57a889a') },
    { projection: { senhaHash: 0 } }
  );
  console.log(JSON.stringify(doc, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
