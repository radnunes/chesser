import { useState, useEffect } from 'react';
import './css/App.css'
import NavBar from './components/NavBar';
import Login from './components/Login';

function App() {
  const [data, setData] = useState(0);

  
  useEffect(() => {
    fetch('http://localhost:3001/api')
      .then((res) => res.json())
      .then((data) => setData(data.message)) 
  }, []);

  return (
    <>
      <NavBar/>
      <Login />
    </>
  )
}

export default App;
