import './framer/styles.css'

import TopbarFramerComponent from './framer/topbar'
import SectionHeroFramerComponent from './framer/section-hero'
import SectionNormalFramerComponent from './framer/section-normal'
import FeatureLinesFramerComponent from './framer/feature-lines'
import TitreFramerComponent from './framer/titre'
import BentoFramerComponent from './framer/bento'
import ClientsFramerComponent from './framer/clients'
import SectionVideoLoopFramerComponent from './framer/section-video-loop'
import SectionMapFramerComponent from './framer/section-map'
import SectionMapsFramerComponent from './framer/section-maps'
import SectionImageFramerComponent from './framer/section-image'
import SectionAppelRapideFramerComponent from './framer/section-appel-rapide'
import SolutionsFramerComponent from './framer/solutions'
import FooterFramerComponent from './framer/global/footer'

export default function App() {
  return (
    <div className='flex flex-col items-center bg-[rgb(1,_1,_1)]'>
      <TopbarFramerComponent.Responsive style={{ position: 'fixed', top: 0, width: '100%', zIndex: 10 }}/>
      <SectionHeroFramerComponent.Responsive style={{ position: 'sticky', top: 0, width: '100%', height: '100vh' }}/>
      <div className='flex flex-col items-center w-full bg-[rgb(1,_1,_1)]' style={{ position: 'relative', zIndex: 2, overflow: 'clip' }}>
        <SectionNormalFramerComponent.Responsive style={{ width: '100%' }}/>
        <FeatureLinesFramerComponent.Responsive style={{ width: '100%' }}/>
        <TitreFramerComponent.Responsive style={{ width: '100%', height: '87vh' }}/>
        <BentoFramerComponent.Responsive style={{ width: '100%' }}/>
        <ClientsFramerComponent.Responsive style={{ width: '100%' }}/>
        <SectionVideoLoopFramerComponent.Responsive style={{ width: '100%' }}/>
        <SectionMapFramerComponent.Responsive style={{ width: '100%' }}/>
        <SectionMapsFramerComponent.Responsive style={{ width: '100%' }}/>
        <SectionImageFramerComponent.Responsive style={{ width: '100%' }}/>
        <SectionAppelRapideFramerComponent.Responsive style={{ width: '100%', height: '87vh' }}/>
        <SolutionsFramerComponent.Responsive style={{ width: '100%' }}/>
        <FooterFramerComponent.Responsive style={{ width: '100%' }}/>
      </div>
    </div>
  );
};