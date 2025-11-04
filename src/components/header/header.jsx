import React from 'react'
import './header.css'
import Logo from '../../assets/logo.png'
//import Login from '../login/login.jsx'

const header = () => {
  return (
    <div className="header">
      <img src={Logo} alt="" className="logo" />
      <ul className="header-menu">
        <li>Home</li>
        <li>Leader Board</li>
        <li>Contact Us</li>
      </ul>
    </div>
  )
}

export default header
