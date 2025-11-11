import React , {useState} from 'react'
import './Testimonials.css'
import { testimonialsData } from '../data/testimonialsData'     
import leftArrow from '../assets/leftArrow.png'
import  rightArrow from '../assets/rightArrow.png'
import {motion} from 'framer-motion'



const Testimonials = () => {

 const transition ={type:"spring",duration:3};
 const[selected, setSelected] = useState(0);
 const tLength = testimonialsData.length;  
 

  return (
   <div className="testimonials">
  <div className="left-t">
    <span>About Us</span>
    <span className="stoke-text">What We Assiche</span>
    <span>Currently</span>
    <motion.span
    key={selected}
    initial={{opacity:0,x:-100}}
    animate={{opacity:1,x:0}}
    exit={{opacity:0,x:100}}
    transition={transition}
    >{testimonialsData[selected].review}</motion.span>
    <span>
      <span style={{ color: 'var(--red)' }}>
        {testimonialsData[selected].name} -{" "}
      </span>
      {testimonialsData[selected].status}
    </span>
  </div>

  <div className="right-t">
    {/* decorative layers */}
    <motion.div 
    initial={{opacity:0,x:-100}}
    transition={{...transition,duration:3}}
    whileInView={{opacity:1,x:0}}
    className="frame"></motion.div>

    <motion.div 
    initial={{opacity:0,x:100}}
    transition={{...transition,duration:3}}
    whileInView={{opacity:1,x:0}}
    className="bg-block"></motion.div>

    {/* main image */}
    <motion.img 
    key={selected}
    initial={{opacity:0,x:100}}
    animate={{opacity:1,x:0}}
    exit={{opacity:0,x:-100}}
    transition={transition}
    src={testimonialsData[selected].image} alt="member" />

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
