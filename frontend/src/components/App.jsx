import React, { useState, useEffect } from 'react';
import '../css/App.css'

function App() {
  const [data, setData] = useState(0);

  useEffect(() => {
    fetch('http://localhost:3001/api')
      .then((res) => res.json())
      .then((data) => setData(data.message)) 
  }, []);

  return (
    <>
      <p>{!data ? "Loading..." : data}</p>
    </>
  )
}

export default App;
