db.usuarios.updateOne(
  { _id: ObjectId('6a5a5ab7e0350e32e57a889a') },
  { $set: { deveTrocarSenha: false } }
);
printjson(db.usuarios.findOne(
  { _id: ObjectId('6a5a5ab7e0350e32e57a889a') },
  { senhaHash: 0 }
));
