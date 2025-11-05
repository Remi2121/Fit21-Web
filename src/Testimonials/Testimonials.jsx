import React , {useState} from 'react'
import './Testimonials.css'
import { testimonialsData } from '../data/testimonialsData'     
import leftArrow from '../assets/leftArrow.png'
import rightArrow from '../assets/rightArrow.png'

const Testimonials = () => {

 const[selected, setSelected] = useState(0);
 const tLength = testimonialsData.length;  

  return (
   <div className="testimonials">
  <div className="left-t">
    <span>About Us</span>
    <span className="stoke-text">What We Assiche</span>
    <span>Currently</span>
    <span>{testimonialsData[selected].review}</span>
    <span>
      <span style={{ color: 'var(--red)' }}>
        {testimonialsData[selected].name} -{" "}
      </span>
      {testimonialsData[selected].status}
    </span>
  </div>

  <div className="right-t">
    {/* decorative layers */}
    <div className="frame"></div>
    <div className="bg-block"></div>

    {/* main image */}
    <img src={testimonialsData[selected].image} alt="member" />

    {/* arrows */}
    <div className="arrows">
      <img
        src={leftArrow}
        alt="previous"
        onClick={() => setSelected((p) => (p === 0 ? tLength - 1 : p - 1))}
      />
      <img
        src={rightArrow}
        alt="next"
        onClick={() => setSelected((p) => (p === tLength - 1 ? 0 : p + 1))}
      />
    </div>
  </div>
</div>

  )
}

export default Testimonials
