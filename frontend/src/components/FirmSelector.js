import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const FirmSelector = () => {
  const { user, selectedFirm, setSelectedFirm } = useAuth();
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFirms();
  }, []);

  const fetchFirms = async () => {
    try {
      const response = await axios.get('/api/firms/my-firms');
      if (response.data.success) {
        setFirms(response.data.data);
        
        // Set default firm if not already set
        if (!selectedFirm && response.data.data.length > 0) {
          const primaryFirm = response.data.data.find(f => f.is_primary) || response.data.data[0];
          setSelectedFirm(primaryFirm);
        }
      }
    } catch (error) {
      console.error('Error fetching firms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFirmChange = (e) => {
    const firmId = parseInt(e.target.value);
    const firm = firms.find(f => f.id === firmId);
    setSelectedFirm(firm);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading firms...</div>;
  }

  if (firms.length === 0) {
    return null;
  }

  return (
    <div className="firm-selector">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Active Firm
      </label>
      <select
        value={selectedFirm?.id || ''}
        onChange={handleFirmChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {firms.map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.firm_name} {firm.is_primary && '(Primary)'}
          </option>
        ))}
      </select>
      
      {selectedFirm && (
        <div className="mt-2 text-xs text-gray-600">
          <div className="flex items-center">
            <span className="font-semibold mr-2">Code:</span>
            <span>{selectedFirm.firm_code}</span>
          </div>
          {user?.role === 'admin' && (
            <div className="flex items-center mt-1">
              <span className="font-semibold mr-2">Access:</span>
              <span className="capitalize">{selectedFirm.access_level || 'Full'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FirmSelector;