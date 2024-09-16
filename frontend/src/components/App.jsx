import React, { useState, useEffect } from 'react';
import '../css/App.css'
import NavBar from './NavBar';
import Login from './Login';

function App() {
  const [data, setData] = useState(0);

  
  useEffect(() => {
    fetch('http://localhost:3001/api')
      .then((res) => res.json())
      .then((data) => setData(data.message)) 
  }, []);

  return (
    <>
      <Login />
    </>
  )
}

export default App;
