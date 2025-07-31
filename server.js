const express = require('express');
const app = express();

// Use a porta fornecida pelo Railway
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Anti-Raid Bot is running');
});

module.exports = {
  start: (client) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Web dashboard listening on port ${PORT}`);
    });

    // se quiser, adicione rotas relacionadas ao client aqui
  }
};
