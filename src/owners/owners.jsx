import React , {useState} from 'react'
import './owners.css'
import { OwnersData } from '../data/ownersData'     
import leftArrow from '../assets/leftArrow.png'
import rightArrow from '../assets/rightArrow.png'
import {motion} from 'framer-motion'

const Owners = () => {

  const transition ={type:"spring",duration:3};
 const[selected, setSelected] = useState(0);
 const tLength = OwnersData.length;  

  return (
   <div className="owners">
  <div className="right-o">
    {/* decorative layers */}
    <motion.div
    initial={{opacity:0,x:-100}}
    transition={{...transition,duration:3}}
    whileInView={{opacity:1,x:0}}
    className="frame"></motion.div>

    <motion.div  initial={{opacity:0,x:100}}
    transition={{...transition,duration:3}}
    whileInView={{opacity:1,x:0}}
    className="bg-block"></motion.div>

    {/* main image */}
    <motion.img 
        key={selected}
        initial={{opacity:0,x:100}}
        animate={{opacity:1,x:0}}
        exit={{opacity:0,x:-100}}
        transition={transition}src={OwnersData[selected].image} alt="member" />

    {/* arrows */}
    <div className="owners-arrows">
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
    <div className="left-o">
    <span>Teame Members</span>
    <span className="stoke-text">Top 3 Members</span>
    <span>Currently</span>
    <motion.span
    key={selected}
    initial={{opacity:0,x:-100}}
    animate={{opacity:1,x:0}}
    exit={{opacity:0,x:100}}
    transition={transition}>{OwnersData[selected].review}</motion.span>
    <span>
      <span style={{ color: 'var(--red)' }}>
        {OwnersData[selected].name} -{" "}
      </span>
      {OwnersData[selected].status}
    </span>
  </div>

</div>

  )
}

export default Owners
