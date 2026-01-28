import { useEffect } from 'react';

const useScreenDetection = (onDetection) => {
    useEffect(() => {
        const handleBlur = () => {
            onDetection();
        };

        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('blur', handleBlur);
        };
    }, [onDetection]);
};

export default useScreenDetection;
