import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './css/index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom' 
import Login from './routes/Login'
import Register from './routes/Register'
import Home from './routes/Home'
import About from './routes/About'

const router = createBrowserRouter([
  {path:'/', element: <Home/>},
  {path:'/login', element: <Login />},
  {path:'/register', element: <Register />},
  {path:'/about', element: <About />}
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router = {router} />
  </StrictMode>,
)
