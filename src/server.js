require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`IDN Attendance API berjalan di http://localhost:${PORT}`);
});
