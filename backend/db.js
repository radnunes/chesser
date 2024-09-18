import pg from 'pg'
const { Client } = pg

const client = new Client({
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "0000",
    database: "chesser_db"
})

await client.connect()

client.connect();


client.query(`Select * from users`, (error, res) => {
    if(!err) {
        console.log(res.rows);
    } else {
        console.log(err.message);
    }
    client.end;
})