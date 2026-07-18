const db2 = db.getSiblingDB('MundoSmart');
print('COLLECTIONS: ' + JSON.stringify(db2.getCollectionNames()));
const usuarios = db2.getCollection('usuarios').find().toArray();
print('USUARIOS:');
print(JSON.stringify(usuarios, null, 2));
