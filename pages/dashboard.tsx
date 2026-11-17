import './dashboard.css'
import Image from '../assets/dashboardHero.png'
import Filter from '../assets/filter.svg'
//important header for TSX i guess; zont forget!

export default function Dashboard() {
return(

    <div style={{display: 'flex', flexDirection: 'column', justifyContent:'center'}}>
        <img src={Image} alt="dashboard hero image"/>
        <div style={{padding: '51px'}}/>
        <div style={{display: 'flex', flexDirection: 'row', width: '1120px', height: '54px', justifyContent:'center', gap: '27px'}}>
            <div className="searchInput">
                Input Field Here
            </div>
    
            <div className="filterButton">
                Filter
                <img src={Filter}/>
            </div>
        </div>
    </div>

)
}

//dashboard components starting here: