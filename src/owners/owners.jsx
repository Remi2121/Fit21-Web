import React , {useState} from 'react'
import './owners.css'
import { OwnersData } from '../data/ownersData'     
import leftArrow from '../assets/leftArrow.png'
import rightArrow from '../assets/rightArrow.png'

const Owners = () => {

 const[selected, setSelected] = useState(0);
 const tLength = OwnersData.length;  

  return (
   <div className="owners">
  <div className="right-o">
    {/* decorative layers */}
    <div className="frame"></div>
    <div className="bg-block"></div>

    {/* main image */}
    <img src={OwnersData[selected].image} alt="member" />

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
    <span>{OwnersData[selected].review}</span>
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
