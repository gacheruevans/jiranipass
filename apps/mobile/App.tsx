import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { VisitStatus, HouseholdSearchResult, VisitRequestResponse } from '@jiranipass/shared';

const API_URL = 'http://localhost:4000'; // For physical Android devices, use LAN IP (e.g. 192.168.x.x)

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Samson O.');
  const [activeTab, setActiveTab] = useState<'NEW_VISIT' | 'LIVE_QUEUE'>('NEW_VISIT');

  // Login form state
  const [phone, setPhone] = useState('+254799000001');
  const [pin, setPin] = useState('1234');
  const [gateId, setGateId] = useState('GATE-MAIN');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // New Visit form state
  const [households, setHouseholds] = useState<HouseholdSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdSearchResult | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [purpose, setPurpose] = useState('Personal visit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Requests queue state
  const [requests, setRequests] = useState<VisitRequestResponse[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VisitRequestResponse | null>(null);

  // Supervisor Override modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overridePin, setOverridePin] = useState('9999');
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  // Login handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/guard/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          pin,
          gateId,
          deviceId: 'TABLET-GATE-MAIN',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setGuardName(data.user.name);
      } else {
        const err = await res.json();
        Alert.alert('Sign In Failed', err.message || 'Check your phone and PIN');
      }
    } catch (e: any) {
      // In offline / local demo fallback, auto-login for gate test
      setToken('demo-guard-token');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Search households
  useEffect(() => {
    if (!token) return;
    const fetchHouseholds = async () => {
      try {
        const res = await fetch(`${API_URL}/v1/households?query=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHouseholds(data);
        }
      } catch (e) {
        // Fallback demo households
        setHouseholds([
          { id: '1', unitCode: 'House B12', primaryResidentName: 'Mary Nduta', maskedPhone: '+254 7XX XXX 678', isActive: true },
          { id: '2', unitCode: 'House A1', primaryResidentName: 'John Kamau', maskedPhone: '+254 7XX XXX 001', isActive: true },
          { id: '3', unitCode: 'House A2', primaryResidentName: 'Grace Wanjiku', maskedPhone: '+254 7XX XXX 002', isActive: true },
        ]);
      }
    };
    fetchHouseholds();
  }, [token, searchQuery]);

  // Fetch live requests
  const fetchRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/v1/visit-requests?limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (e) {
      console.warn('Queue poll error');
    }
  };

  useEffect(() => {
    if (token) {
      fetchRequests();
      const interval = setInterval(fetchRequests, 3000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Create Visit Request
  const handleCreateRequest = async () => {
    if (!selectedHousehold || !visitorName.trim()) {
      Alert.alert('Required Fields', 'Please select a household unit and enter visitor full name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/visit-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          visitorName: visitorName.trim(),
          vehiclePlate: vehiclePlate.trim() || undefined,
          purpose: purpose.trim() || undefined,
          gateId,
        }),
      });

      if (res.ok) {
        const newReq = await res.json();
        Alert.alert('WhatsApp Sent', `Request reference ${newReq.reference} dispatched to ${selectedHousehold.primaryResidentName}.`);
        setVisitorName('');
        setVehiclePlate('');
        setSelectedHousehold(null);
        setActiveTab('LIVE_QUEUE');
        fetchRequests();
      } else {
        const err = await res.json();
        Alert.alert('Request Failed', err.message || 'Could not dispatch request');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guard Check-in (Admit)
  const handleCheckIn = async (requestId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/visit-requests/${requestId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verificationMethod: 'PHYSICAL_RECOGNITION',
          notes: 'Identity confirmed at gate',
        }),
      });

      if (res.ok) {
        Alert.alert('Visitor Admitted', 'Check-in recorded. Gate opened.');
        fetchRequests();
      } else {
        const err = await res.json();
        Alert.alert('Check-in Denied', err.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Guard Check-out
  const handleCheckOut = async (requestId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/visit-requests/${requestId}/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: 'Departed via main gate' }),
      });

      if (res.ok) {
        Alert.alert('Departure Recorded', 'Visitor checked out successfully.');
        fetchRequests();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Supervisor Override
  const handleSupervisorOverride = async () => {
    if (!selectedRequest || overrideReason.trim().length < 10) {
      Alert.alert('Validation Error', 'A detailed override reason of at least 10 characters is mandatory.');
      return;
    }

    setIsOverriding(true);
    try {
      const res = await fetch(`${API_URL}/v1/visit-requests/${selectedRequest.id}/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supervisorPin: overridePin,
          reason: overrideReason.trim(),
          verificationMethod: 'PHONE_CALL_CONFIRMED',
        }),
      });

      if (res.ok) {
        Alert.alert('Override Admitted', 'Supervisor exception recorded in immutable audit log.');
        setShowOverrideModal(false);
        setOverrideReason('');
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const err = await res.json();
        Alert.alert('Override Rejected', err.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsOverriding(false);
    }
  };

  // 1. RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  if (!token) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>J</Text>
          </View>
          <Text style={styles.appTitle}>JiraniPass Guard</Text>
          <Text style={styles.appSubtitle}>Security Gate Tablet Station</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Guard Registered Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Guard Station PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Gate Assignment</Text>
            <TextInput
              style={styles.input}
              value={gateId}
              onChangeText={setGateId}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Start Guard Shift</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 2. RENDER MAIN GUARD STATION
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Gate Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Green Valley Estate</Text>
          <Text style={styles.headerSubtitle}>Gate: {gateId} • Guard: {guardName}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setToken(null)}
        >
          <Text style={styles.logoutText}>End Shift</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'NEW_VISIT' && styles.activeTab]}
          onPress={() => setActiveTab('NEW_VISIT')}
        >
          <Text style={[styles.tabText, activeTab === 'NEW_VISIT' && styles.activeTabText]}>
            ➕ Log Arriving Visitor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'LIVE_QUEUE' && styles.activeTab]}
          onPress={() => setActiveTab('LIVE_QUEUE')}
        >
          <Text style={[styles.tabText, activeTab === 'LIVE_QUEUE' && styles.activeTabText]}>
            ⚡ Live Gate Queue ({requests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: NEW VISITOR ARRIVAL CAPTURE */}
      {activeTab === 'NEW_VISIT' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionHeader}>Step 1: Select Household Unit</Text>
          <TextInput
            style={styles.input}
            placeholder="Type unit code (e.g. House B12)..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.householdList}>
            {households.slice(0, 4).map((h) => {
              const isSelected = selectedHousehold?.id === h.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.householdCard, isSelected && styles.selectedCard]}
                  onPress={() => setSelectedHousehold(h)}
                >
                  <Text style={styles.unitCodeText}>{h.unitCode}</Text>
                  <Text style={styles.residentNameText}>{h.primaryResidentName}</Text>
                  <Text style={styles.maskedPhoneText}>📱 {h.maskedPhone}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedHousehold && (
            <View style={styles.visitorForm}>
              <Text style={styles.sectionHeader}>Step 2: Enter Visitor Details</Text>
              
              <Text style={styles.label}>Visitor Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mary Wambui"
                value={visitorName}
                onChangeText={setVisitorName}
              />

              <Text style={styles.label}>Vehicle Plate (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. KDD 123A"
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Purpose of Visit</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Delivery / Social"
                value={purpose}
                onChangeText={setPurpose}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    📲 Request WhatsApp Approval from {selectedHousehold.primaryResidentName}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* TAB 2: LIVE GATE QUEUE */}
      {activeTab === 'LIVE_QUEUE' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionHeader}>Active Arrival Requests</Text>

          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No active requests</Text>
              <Text style={styles.emptyText}>Arriving visitor requests will appear here live.</Text>
            </View>
          ) : (
            requests.map((req) => {
              const isApproved = req.status === VisitStatus.APPROVED;
              const isPending = req.status === VisitStatus.PENDING;
              const isCheckedIn = req.status === VisitStatus.CHECKED_IN;

              return (
                <View
                  key={req.id}
                  style={[
                    styles.requestCard,
                    isApproved && styles.cardApproved,
                    isPending && styles.cardPending,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardRef}>{req.reference}</Text>
                      <Text style={styles.cardUnit}>{req.unitCode}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{req.status}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.visitorNameDisplay}>👤 {req.visitorName}</Text>
                    {req.vehiclePlate && (
                      <Text style={styles.plateDisplay}>🚗 Plate: {req.vehiclePlate}</Text>
                    )}
                    <Text style={styles.hostDisplay}>Host: {req.assignedResidentName || 'Primary Host'}</Text>
                  </View>

                  {/* ACTION BAR */}
                  <View style={styles.cardActions}>
                    {/* ADMIT BUTTON: Enabled only when approved */}
                    {isApproved && (
                      <TouchableOpacity
                        style={styles.admitButton}
                        onPress={() => handleCheckIn(req.id)}
                      >
                        <Text style={styles.admitButtonText}>
                          ✅ Check ID & Admit Visitor
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* CHECK OUT BUTTON */}
                    {isCheckedIn && (
                      <TouchableOpacity
                        style={styles.checkOutButton}
                        onPress={() => handleCheckOut(req.id)}
                      >
                        <Text style={styles.checkOutButtonText}>
                          👋 Record Departure
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* SUPERVISOR OVERRIDE TRIGGER */}
                    {req.canOverride && (
                      <TouchableOpacity
                        style={styles.overrideButton}
                        onPress={() => {
                          setSelectedRequest(req);
                          setShowOverrideModal(true);
                        }}
                      >
                        <Text style={styles.overrideButtonText}>
                          🛡️ Supervisor Exception
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* SUPERVISOR OVERRIDE MODAL */}
      <Modal visible={showOverrideModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Supervisor Emergency Override</Text>
            <Text style={styles.modalSubtitle}>
              Reference: {selectedRequest?.reference} ({selectedRequest?.visitorName})
            </Text>

            <Text style={styles.label}>Supervisor PIN</Text>
            <TextInput
              style={styles.input}
              value={overridePin}
              onChangeText={setOverridePin}
              secureTextEntry
              keyboardType="numeric"
            />

            <Text style={styles.label}>Mandatory Justification Reason (min 10 chars) *</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder="e.g. Verified resident via landline phone call due to flat phone battery"
              value={overrideReason}
              onChangeText={setOverrideReason}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowOverrideModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOverrideButton}
                onPress={handleSupervisorOverride}
                disabled={isOverriding}
              >
                {isOverriding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmOverrideButtonText}>Confirm Override</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  logoutText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 6,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  householdList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  householdCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    borderRadius: 10,
  },
  selectedCard: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E',
  },
  unitCodeText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  residentNameText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  maskedPhoneText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  visitorForm: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 40,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  formGroup: {
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardApproved: {
    borderColor: '#22C55E',
    backgroundColor: '#064E3B',
  },
  cardPending: {
    borderColor: '#F59E0B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardRef: {
    fontFamily: 'monospace',
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '800',
  },
  cardUnit: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    marginBottom: 12,
  },
  visitorNameDisplay: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  plateDisplay: {
    color: '#FDE047',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  hostDisplay: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  admitButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  admitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  checkOutButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  checkOutButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  overrideButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  overrideButtonText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  confirmOverrideButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  confirmOverrideButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
