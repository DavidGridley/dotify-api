require("dotenv").config();

const bodyParser = require("body-parser");
const pgp = require("pg-promise")();
const express = require("express");
const app = express();
const db = pgp({
  host: "localhost",
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD
});

app.use(bodyParser.json());

app.get("/api/songs", function(req, res) {
  db.any("SELECT artist.name, song.title, song.year, song.id FROM song,artist where song.artist_id=artist.id ")
    .then(function(data) {
      res.json(data);
    })
    .catch(function(error) {
        res.status(404).json({error: error.message});
    });
});

app.get("/api/songs/:id", function(req, res) {
  const id = req.params.id;
  db.any("SELECT song.id, artist.name, song.title FROM song, artist WHERE song.id=$1 and song.artist_id=artist.id", [id])
    .then(function(data) {
      res.json(data);
    })
    .catch(function(error) {
        res.status(404).json({error: error.message})
    });
});

app.post("/api/songs", function(req, res) {
  const { artist_id, title, year} = req.body;
  db.one(
    `INSERT INTO song(artist_id, title, year)
            VALUES($1, $2, $3) RETURNING id; 
            `,
    [artist_id, title, year]
  )
    .then(data => {
        db.one(
            `SELECT artist.name, song.title, song.year, song.id
            from artist, song
            WHERE artist.id = song.artist_id
            and song.id=$1
            `, [data.id]
        )
        .then(data=> res.json(data))
      
    })
    
    .catch(error => {
        res.status(400).json({error: error.message})
    });
});

app.get("/api/artists", function(req, res) {
    db.any('SELECT * FROM artist')
    .then(response => res.json(response))
    .catch(error => res.status(404).json({error: error.message}))
})

app.get("/api/playlists", function(req,res) {
    db.any('SELECT * FROM playlist')
    .then(response => res.json(response))
    .catch(error => res.status(404).json({error: error.message}))
})

app.post("/api/artists", function(req, res) {
    const { name, email } = req.body;
    db.one(
      `INSERT INTO artist(name, email)
              VALUES($1, $2) RETURNING id`,
      [name, email]
    )
      .then(data => {
        res.json(Object.assign({}, { id: data.id }, req.body));
      })
      .catch(error => {
        res.status(400).json({error: error.message})
      });
  });


  app.post("/api/playlists", function(req,res) {
      const { name } = req.body;
      db.one(
          `INSERT INTO playlist(name)
          VALUES ($1) RETURNING id`,
          [name]
      )
      .then(response => res.json(Object.assign({}, {id: response.id}, req.body)))
      .catch(error => {
          res.status(400).json({error: error.message})
      });
  });

  app.post("/api/playlists/:playlistId/songs", function (req, res){
      const {song_id} = req.body;
      const playlist_id=req.params.playlistId;
      db.one(
          `INSERT INTO song_playlist(song_id,playlist_id)
          VALUES ($1, $2) returning id
          `, [song_id, playlist_id]
      )
      .then(response => res.json(response))
      .catch(error => res.status(400).json({error: error.message}))
  })


  app.delete("/playlists/:id/songs/:songId", function(req, res){
      const playlist_id = req.params.id;
      const songId =  req.params.songId;
      db.none(
          `DELETE FROM song_playlist 
          WHERE playlist_id = ($1) 
          AND song_id = ($2)
          `,
          [playlist_id, songId]
      )
      .then(response => res.status(204).json({status: "Success"}))
      .catch(error => res.status(400).json({error: error.message}))
  })

  app.delete("/playlists/:id", function (req, res){
      const playlist_id=req.params.id;
      db.none(
          `DELETE FROM song_playlist 
          WHERE playlist_id=($1)`,[playlist_id]
      )
      .then(remaining => {
          return db.none(
              `DELETE FROM playlist
              WHERE playlist.id=($1)`,[playlist_id]
          )
      })
      .then(response => res.status(204).send())
      .catch(error => res.status(400).json({error: error.message}))
  })

  app.patch('/artists/:id', function(req, res) {
      const artist_id = req.params.id;
      let arguments = Object.keys(req.body);
      arguments=arguments.concat(Object.values(req.body));
      arguments.push(parseInt(artist_id));
      console.log(arguments);
      if (arguments.length === 3) {
          db.none(
            `UPDATE artist SET $1:name = $2 WHERE id=$3`, arguments
          )
          .then(response => res.json(response))
          .catch(error => {
              res.status(400).send()
          })
      } else if (arguments.length === 5) {
        db.none(
            `UPDATE artist SET $1:name = $3, $2:name = $4 WHERE id= $5`, arguments
          )
          .then(response => res.json(response))
          .catch(error => {
            res.status(400).send()
          })
      }
  })

app.patch("/playlists/:id", (req,res) => {
    const playlist_id = req.params.id;
    const {name} =req.body;
    db.none(
        `UPDATE playlist SET name=$1 where id=$2`,[name,playlist_id]
    )
    .then(response => res.json({update:"successful"}))
    .catch(error=> res.status(400).send())
})

app.delete("/song/:id", (req, res) => {
    const song_id = req.params.id;
    db.none(
        `DELETE FROM song_playlist WHERE song_id=$1`, [song_id]
    )
    .then(data => {
        db.none(
            `DELETE FROM song WHERE id=$1`, [song_id]
        )
    })
})

app.listen(8080, function() {
  console.log("Listening on port 8080!");
});
