/*

References : 

https://thecanadianencyclopedia.ca/en/article/aboriginal-people-languages
https://www.statcan.gc.ca/o1/en/plus/3920-canadas-indigenous-population
https://fpcf.ca/take-action/ways-to-give
*/

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Image,
} from 'react-native';


const DonationScreen = () => {
  const handleDonationPress = () => {
    Linking.openURL('https://fpcf.ca/take-action/ways-to-give');
  };

  // Open the culture booklet (external)
  const handleCulturePress = async () => {
    const url = 'https://online.flippingbook.com/view/3524645/';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (e) {
      console.warn('Cannot open url:', e);
    }
  };



  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Title */}
      <Text style={styles.title}>Support the Community {'\n'}</Text>

      {/* Donation heart button */}
      <TouchableOpacity
        style={styles.heartButton}
        onPress={handleDonationPress}
        activeOpacity={0.8}
      >
        <Image
          source={require('../../assets/images/donation.png')}
          style={{ width: 36, height: 36 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Small hint */}
      <Text style={styles.subtitle}>↑ Click to Donate ↑</Text>

      {/* Card: Why donations matter */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image
            source={require('../../assets/images/problem.png')}
            style={styles.cardImage}
            resizeMode="contain"
          />
          <Text style={styles.cardTitle}>Why Donations Matter</Text>
        </View>
        <Text style={styles.cardText}>
          For Indigenous peoples, intergenerational giving is a way of life.
          Elders and Knowledge Keepers pass on language, arts, and traditions
          to the next generation. Your support helps these cultural legacies
          thrive for years to come.
        </Text>
      </View>

      {/* Section heading */}
      <View>
        <Text style={styles.cardTitle}>We could support{'\n'}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>70+</Text>
        <Text style={styles.statLabel}>Indigenous Languages</Text>
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statNumber}>1.8 million +</Text>
        <Text style={styles.statLabel}>Indigenous People</Text>
      </View>

      {/* ▶️ IMAGE + CAPTION (placed ABOVE the link card) */}
      {/* Image credit / reference:
         FPCC (First Peoples' Cultural Council) – Gallery
         https://fpcc.ca/#masonry-gallery-4
         Note: This image is used for educational/demo purposes in the app. */}
      <Image
        source={require('../../assets/images/firstnationpeople.jpg')}
        style={styles.hero}
        accessibilityLabel="First Nations people and cultural carving"
      />
      <Text style={styles.caption}>
        Image © FPCC
      </Text>

      {/* 🔗 Culture booklet link card (kept at the bottom) */}
      <TouchableOpacity
        style={styles.linkCard}
        onPress={handleCulturePress}
        activeOpacity={0.85}
      >
        <View style={styles.linkRow}>
          <View>
            <Text style={styles.linkTitle}>Learn about Indigenous culture</Text>
            <Text style={styles.linkCTA}>{'\n'}Click Here</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Copyright */}
      <Text style={styles.copyright}>© 2025 Cree. All rights reserved.</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 150,
    paddingBottom: 48,
  },
  heartButton: {
    backgroundColor: '#a7d58e',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a2e05',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#3f3f46',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 30,
    lineHeight: 22,
    paddingBottom: 50,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: '#e9f2e1',
    borderRadius: 12,
    padding: 18,
    width: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    marginBottom: 25,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardImage: { width: 28, height: 28, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e05' },
  cardText: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 20,
    textAlign: 'left',
  },
  statBox: {
    backgroundColor: '#f3f4f0',
    width: '80%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#1a2e05', paddingBottom: 7 },
  statLabel: { fontSize: 14, color: '#3f3f46' },

    hero: {
    width: 260,          // set explicit width
    height: 195,         // 260 * 3/4 (to keep 4:3)
    borderRadius: 12,
    marginTop: 6,
    },

  caption: {
    width: '85%',
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 8,
    textAlign: 'center',
  },
  referencesCard: {
    backgroundColor: '#f3f4f0',
    width: '85%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  refTitle: { fontSize: 14, fontWeight: '700', color: '#1a2e05', marginBottom: 8 },
  refLink: { fontSize: 13, color: '#1d4ed8', marginBottom: 6, textDecorationLine: 'underline' },

  linkCard: {
    backgroundColor: '#e9f2e1',
    width: '85%',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  linkTitle: { fontSize: 16, fontWeight: '700', color: '#1a2e05' },
  linkCTA: { fontSize: 14, fontWeight: '600', color: '#638b0e', textAlign: 'left', marginLeft: 10 },
  copyright: { fontSize: 12, color: '#6b7280', marginTop: 20, marginBottom: 30, textAlign: 'center' },
});

export default DonationScreen;
