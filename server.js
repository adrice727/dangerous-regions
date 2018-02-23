const express = require('express');


const app = express();
const port = process.env.PORT || 8000;


app.get('/regions', (req, res) => {
  res.send('hello there');
})


app.listen(port, () => console.log(`API Server listening on port ${port}`));