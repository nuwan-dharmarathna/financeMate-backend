const mongoose = require('mongoose');
const dotenv = require('dotenv');
const punycode = require('punycode/');

dotenv.config({ path: './.env' });

const app = require('./app');

const DB = process.env.DATABASE;

mongoose.connect(DB).then(() => {
  console.log('✅ DB connection successful!');
});

const port = process.env.PORT;

app.listen(port, () => {
  console.log(`✅ App running on port ${port}`);
});
