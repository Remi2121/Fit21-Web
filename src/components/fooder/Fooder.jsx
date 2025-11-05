import React from 'react'
import './Fooder.css'
import facebook from '../../assets/facebook.png'
import instagram from '../../assets/instagram.png'


const Fooder = () => {
  return (
    <div className="Footer-container">
    <hr/>
      <div className="footer">
      <div className="social-links">
        <img src={facebook} alt="" />
        <img src={instagram} alt="" />
      </div>
      <div className="blur-f-1"></div>
      <div className="blur-f-2"></div>
      </div>
    </div>

  )
}

export default Fooder
